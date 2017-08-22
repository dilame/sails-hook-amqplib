const defaults = require('lodash.defaults');
const amqplib = require('amqplib');
const requireAll = require('require-all');

module.exports = function SailsHookAmqplibJobs(sails) {
  return {
    defaults: {
      __configKey__: {
        dirname: `${sails.config.appPath}/api/queues`,
        defaultPrefetch: 10,
      },
    },
    initialize(done) {
      const config = sails.config[this.configKey];
      this.connectionPromise = amqplib.connect(config.url);
      this.publishChannel = this.createChannel(); // cache publish channel
      sails.after('lifted', () => this.initAllWorkers());
      done();
    },
    /**
     * @returns {Promise} cached connection
     */
    getConnection() {
      return this.connectionPromise;
    },
    /**
     * @returns {Promise} cached channel for publishing
     */
    getPublishChannel() {
      return this.publishChannel;
    },
    /**
     * @returns {channel} new channel
     */
    createChannel() {
      return this.getConnection()
        .then(connection => connection.createChannel());
    },
    /**
     * Register workers, subscribe them to their queues.
     * One channel per worker.
     */
    initAllWorkers() {
      const config = sails.config[this.configKey];
      this.workers = {};
      const workers = requireAll({
        dirname: config.dirname,
        filter: /(.+Queue)\.js$/,
        recursive: true,
      });
      Object.keys(workers).forEach((key) => {
        const worker = defaults(workers[key], {
          prefetch: config.defaultPrefetch,
          durable: true,
          name: key,
        });
        this.workers[key] = worker;
        this.createChannel()
          .then((channel) => {
            channel.prefetch(worker.prefetch);
            channel.assertQueue(worker.name, { durable: worker.durable })
              .then(() => {
                channel.consume(worker.name, this.wrapWorker(worker, channel));
              });
          });
      });
    },
    /**
     * Wrap worker function for use promises to ack or nack message.
     * @param {object} worker - worker object with config.
     * @param {channel} channel - channel that can ack message.
     * @returns {function} wrapped function.
     */
    wrapWorker(worker, channel) {
      return (message) => {
        let content;
        switch (worker.contentType) {
          case 'json': content = JSON.parse(message.content.toString());
            break;
          case 'string': content = message.content.toString();
            break;
          default : content = message;
        }
        const handler = worker.handler || worker.process;
        handler(content)
          .then(() => {
            channel.ack(message);
          })
          .catch(() => {
            if (message.fields.redelivered) {
              channel.nack(message, false, false); // nack and don't requeue
            } else {
              channel.nack(message, false, true); // nack and requeue
            }
          });
      };
    },
    /**
     * Publish message to queue.
     * @param {string} queue - name of queue.
     * @param {*} message - message content.
     */
    publish(queue, message) {
      this.getPublishChannel()
        .then(channel => channel.sendToQueue(queue, new Buffer(JSON.stringify(message))));
    },
  };
};
