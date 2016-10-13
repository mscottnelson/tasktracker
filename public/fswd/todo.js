import angular from 'angular';

angular.module('fswd.todo', [])
  .service('TodoListService', function($http) {
    var todoList = ['Groceries', 'Dinner', 'Breakfast'];

    this.retrieveTodoList = function() {
      return $http.get('/tasks')
        .then(function(response) {
          todoList = response.data;
        });
    };

    this.getTodoList = function() {
      return todoList;
    };

    this.removeTodo = function(item) {
      $http.post('/completedTasks', item) //this should probably be done with JSON somehow instead of the HTML post I'm using here
        .then(function(response){
          todoList = response.data;
        })
        .catch(function(error) {
          console.log("Error: " + error);
        });
    };

    this.addTodo = function(toAdd) {
     $http.post('/tasks', { todo: toAdd })
       .then(function(response) {
         todoList = response.data;
       })
       .catch(function(error) {
         console.log("Error: " + error);
       });

    this.deleteTodo = function(item) {
      // DELETE THE ITEM FROM DATABASE!
    };
   };

  })
  .controller('TodoListController', function(TodoListService, $scope) {
    var vm = this;
    TodoListService.retrieveTodoList();

    vm.removeTodo = function(item) {
      TodoListService.removeTodo(item);
    };

    vm.addTodo = function(toAdd) {
      TodoListService.addTodo(toAdd);
    };

    vm.deleteTodo = function(item) {
      TodoListService.deleteTodo(item);
    };

    $scope.$watch(function() {
      return TodoListService.getTodoList();
    }, function(newVal, oldVal) {
      vm.todoList = newVal;
    });

  });
