const http = require('http');

const req = http.request('http://localhost:3579/api/events?agent=test', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
    process.exit(0); // Exit after receiving the first event ("connected")
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});
req.end();
