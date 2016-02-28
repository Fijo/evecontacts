(function(angular, undefined)	{
	'use strict';

	angular.module('main').config(['$locationProvider', function($locationProvider){
	    $locationProvider.html5Mode(true);    
	}]);
})(angular)