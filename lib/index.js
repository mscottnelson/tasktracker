'use strict';

var app = require('./server');

app.listen(process.env.PORT || 8000, function() {
  console.log("Server listening!")
});
