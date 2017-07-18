# sails-hook-amqplib

sails hook for easy amqplib integration.

By default jobs are defined in api/workers.  They should look like this:
```javascript
// api/queues/MyTestQueue.js
module.exports = {
    name: 'my:test', // not required, by default equals filename without .js
    contentType:'json',
    process(content) { // required
        console.log(content)
        return Promise.resolve()
    },
    durable: true, // optional, defaults to true
    prefetch: 3 // optional, defaults to 10
}
```
A config file is also required, it should look something like this:
```javascript
module.exports.amqplib = {
    url:process.env.AMQP_URL
}
```

Once this is set up, you can create a new job like this:
```javascript
sails.hooks.amqplib.publish('my:queue', 'foo bar');
sails.hooks.amqplib.publish('my:queue', { foo: 'bar' });
```

Also you can get pure amqplib connection or create new pure amqplib channel at any moment:
```javascript
sails.hooks.amqplib.getConnection()
    .then(connection => console.log(connection));
sails.hooks.amqplib.createChannel()
    .then(channel => createChannel.prefetch(100))
```


