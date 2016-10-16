'use strict';

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    redis = require('connect-redis');

var models = require('../models');

app.use(cookieParser());
var RedisStore = redis(session);
var store = new RedisStore( process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {} ); // if there's a production environment redis_url, use it, else just move along
app.use(session({
  secret: 'Shhhhh!',
  resave: false,
  saveUninitialized: true,
  store: store
}));

app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

app.set('views', './views');
app.set('view engine', 'pug');

app.use(function(request, response, next) {
  if (request.session.user_id) {
    models.User.findById(request.session.user_id)
      .then(function(user) {
        if (user) {
          response.locals.user = request.user = user;
        }
        next();
      })
  } else {
    next();
  }
});

app.get("/", function(request, response) {
  response.render('index', { name: request.session.username });
});

// app.get('/:name', function(request, response) {
//   response.render('name', { name: request.params.name });
// });

app.get('/tasks', function(request, response) {
  findTasksByUser(request, response);
});

// function Abstraction
function findTasksByUser(request, response){
  if(!request.session.user_id){ //render the global task list if no user is logged in
    models.Task.findAll({
      where: {
        UserId: null
      }
    })
    .then(function(tasks) {
      response.format({
        html: function() {
          response.render('tasks/tasks', { tasks: tasks });
        },
        json: function() {
          response.json(tasks);
        }
      });
    });
  } else{
    models.Task.findAll({
      where: {
        UserId: request.session.user_id
      }
    })
    .then(function(tasks) {
      response.format({
        html: function() {
          response.render('tasks/tasks', { tasks: tasks });
        },
        json: function() {
          response.json(tasks);
        }
      });
    });
  }

};

app.get('/tasks/completed', function(request, response) {
  models.Task.scope('completed').findAll()
    .then(function(tasks) {
      response.format({
        html: function() {
          response.render('tasks/tasks', { tasks: tasks });
        },
        json: function() {
          response.json(tasks);
        }
      });
    });
});

app.get('/tasks/:task_id', function(request, response) {
  console.log(request.session);
  models.Task.findById(request.params.task_id)
    .then(function(task) {
      response.render('tasks/task', { task: task });
    });
});

function redirectToTask(response, task) {
  response.redirect('/tasks/' + task.id);
}

app.post('/tasks/:task_id', function(request, response) {
  models.Task.findById(request.params.task_id)
    .then(function(task) {
      task.name = request.body.todo;
      return task.save();
    }).then(function (task) {
      request.flash('bg-info', "Updated successfully!");
      request.session.save(function() {
        redirectToTask(response, task);
      });
    });
});

app.post('/tasks', function(request, response) {
  models.Task.create({ name: request.body.todo, UserId: request.session.user_id })
    .then(function(task) {
      // request.flash('bg-info', "Added task " + task.name + " successfully!"); // you can use this to display a one-time message when the page loads
      request.session.save(function() {
        response.redirect("/tasks");
      });
    });
});

app.get('/users/login', function(request, response) {
  response.render('users/login');
});

app.get('/users/register', function(request, response) {
  response.render('users/register');
});

app.get("/users/logout", function(req, res) {
  req.session.destroy(function(err){
    if(err){
      console.log('Error destroying user session...');
    }
    else{
      res.redirect('/');
    }
  });
});

var User = require('../models').User;

// app.get('/users/:user_id', function(request, response) {
//   models.User.findOne({
//     where: {
//       username: request.params.user_id
//     }
//   })
//     .then(function(user){
//       response.render('index', { name: user.username} );
//     });
// });

app.post('/users/register', function(request, response) {
  if (request.body.password !== request.body.password_confirm) {
    request.flash('bg-warning', 'Passwords must match');
    response.render('users/register')
    // request.session.save(function() {
    //   response.redirect('/users/register');
    // });
  } else {
    User.findOne({ where: { username: request.body.username }})
      .then(function(existingUser) {
        if (existingUser) {
          request.flash('bg-warning', "User already exists");
          response.render('users/register')
          // request.session.save(function() {
          //   response.redirect('/users/register');
          // })
        } else {
          User.create(request.body).then(function(user) {
            request.session.user_id = user.id;
            request.session.save(function() {
              response.redirect('/');
            });
          }, function(error) {
            request.flash('bg-warning', error.message);
            request.session.save(function() {
              response.redirect('/users/register');
            });
          });
        }
      });
  }
});

app.post('/users/login', function(req, res) {
  User.findOne({ where: { username: req.body.user_id }})
    .then(function(user) {
      res.format({
        html: function() {
          if (!user) {
            res.end('User not found');
          } else if (user.isValidPassword(req.body.password)) {
            req.session.user_id = user.id;
            req.session.save(function() {
              res.redirect('/');
            });
          } else {
            res.end('Password incorrect');
          }
        },
        json: function() {
          if (!user) {
            res.status(401).json({ error: 'User does not exist' });
          } else if (user.isValidPassword(req.body.password)) {
            req.session.user_id = user.id;
            req.session.save(function() {
              res.json({ success: true });
            });
          } else {
            res.status(401).json({ error: 'Password incorrect' });
          }
        }
      });
    });
});

app.post('/users/available', function(request, response) {
  User.findOne({ where: { username: request.body.username }})
    .then(function(user) {
      response.json({ isAvailable: !user });
    });
});

app.get('/users/:user_id', function(request, response) {
  models.User.findById(request.params.user_id, { include: models.Task })
    .then(function(user) {
      response.render('index', { name: user.username} );
      // user <= user
      // tasks <= user.Tasks
    })
});

app.get('/angular-playground', function(request, response) {
  response.render('angular/playground');
});

app.post('/completedTasks', function(request, response) {
  models.Task.findById(request.body.id)
    .then(function(task) {
      task.markCompleted();
    })
    .then(function(task) {
      //request.session.flash_message = "Task " + task.name + " completed.";
      request.session.save(function() {
        response.redirect("/tasks");
      })
    })
});

app.post('/deleteTask', function(request, response) {
  models.Task.findById(request.body.id)
    .then(function(task) {
      task.markForRemoval();
    })
    .then(function(task) {
      //request.session.flash_message = "Task " + task.name + " completed.";
      request.session.save(function() {
        response.redirect("/tasks");
      })
    })
});

app.get('/verify/:user_verificationcode', function(request, response) {
  User.findOne({ where: { emailKey: request.params.user_verificationcode }})
    .then(function(user) {
      user.userVerified();
      response.render('verified');
    })
});

// allow other modules to use the server
module.exports = app;
