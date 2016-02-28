(function(angular, undefined)	{
	'use strict';
	
	angular.module('main').controller('ErrorController', function($scope, $http) {
	  $scope.delEx = function(id) {
	    $http({
	      method: 'POST',
	      data: {id: id},
	      url: '/ex/del'
	    }).then(function()  {

	    });
	  };
	});
})(angular)