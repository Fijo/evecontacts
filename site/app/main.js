(function(angular, undefined)	{
	'use strict';
	
	angular.module('main').controller('MainController', function($scope, $location, $http, _) {
	  var clientId = '';
	  $http({
	      method: 'GET',
	      url: '/clientId'
	    }).then(function(data)  {
	      clientId = data.data;
	    });

	  var params = $location.search();
	  if(params.code != null)  {
	    $http({
	      method: 'POST',
	      data: {code: params.code, characterType: params.characterType},
	      url: '/user/add'
	    }).then(function()  {
	      $location.search({});
	    });
	  }



	  var updateData = function()  {
	    $http({
	      method: 'POST',
	      url: '/user'
	    }).then(function successCallback(response) {
	      _.extend($scope, response.data);
	    });
	  };

	  updateData();
	  var updateDataInterval = setInterval(updateData, 10000);

	  $scope.detail = {
	    contact: {},
	    character: {}
	  };

	  $scope.loggout = function(character) {
	    $http({
	      method: 'POST',
	      data: {characterType: character.type},
	      url: '/user/remove'
	    }, function() {
	      updateData();
	    });
	  };

	  $scope.getLoginUrl = function(character) {
	    if(clientId == '') return;
	    return 'https://login.eveonline.com/oauth/authorize/?response_type=code&redirect_uri='
	      + encodeURIComponent('http://' + $location.host() + ':3000/?characterType='+character.type)
	      + '&client_id=' + clientId + '&scope=characterContactsRead%20characterContactsWrite';
	  };

	  $scope.getStandingImage = function(standing)  {
	    return '/img/contact/standing/' + standing + '.png';
	  }

	  $scope.getContactImage = function(contact, size) {
	    if(size == null) size = 32;
	    switch(contact.contactType) {
	      case 'Character':
	        return contact.character.portrait[size + 'x' + size].href;
	      case 'Alliance':
	        return 'http://imageserver.eveonline.com/Alliance/' + contact.alliance.id + '_' + size + '.png';
	      case 'Corporation':
	        return contact.corporation.logo[size + 'x' + size].href;
	    }
	  };

	  $scope.contactHasFlag = function(contact)  {
	    return contact.watched || contact.blocked;
	  };

	  $scope.getContactFlagImage = function(contact) {
	    return '/img/contact/' + (contact.blocked ? (contact.watched ? 'blocked-watched.png' : 'blocked.png') : 'watched.png');
	  };

	  $scope.getContactDisplayName = function(contact) {
	    var name = contact.contact.name;
	    switch(contact.contactType) {
	      case 'Character':
	        return name;
	      case 'Corporation':
	        return name + ' (Corp)';
	      case 'Alliance':
	        return name + ' (Ally)';
	    }
	  };

	  $scope.getEveWhoLink = function(contact) {
	    var name = contact.contact.name;
	    switch(contact.contactType) {
	      case 'Character':
	        return 'http://evewho.com/pilot/' + name;
	      case 'Corporation':
	        return 'http://evewho.com/corp/' + name;
	      case 'Alliance':
	        return 'http://evewho.com/alli/' + name;
	    }
	  };

	  $scope.getzKillboardLink = function(contact) {
	    return 'https://zkillboard.com/' + contact.contactType.toLocaleLowerCase() + '/' + contact.contact.id + '/';
	  };

	  $scope.content = {};
	  _.each(['Source', 'Target'], function(type) {
	    $scope.content[type] = {
	      paging: {
	        page: 1,
	        pageSize: 10
	      }
	    };
	  });

	  $scope.getPaging = function(character)  {
	    return $scope.content[character.type].paging;
	  };

	  $scope.getForPage = function(character, filter)  {
	    var contactList = $scope.filterContacts(character.contacts, filter);
	    var paging = $scope.getPaging(character);
	    var a = [];
	    for(var i = (paging.page -1) * paging.pageSize, e = Math.min(i + paging.pageSize, contactList.length); i < e; i++)
	      a.push(contactList[i]);
	    return a;
	  };

	  $scope.getTotalItemCount = function(character, filter)  {
	    return $scope.filterContacts(character.contacts, filter).length;
	  };

	  $scope.selection = {};

	  $scope.isContactSelected = function(character, contact) {
	    return $scope.selection[contact.contact.id];
	  }

	  $scope.contactToggleSelected = function(character, contact)  {
	    $scope.detail.character = character;
	    $scope.detail.contact = contact;
	    $scope.contactSetSelected(character, contact, !$scope.isContactSelected(character, contact));
	  };

	  $scope.contactSetSelected = function(character, contact, selected)  {
	    $scope.selection[contact.contact.id] = selected;
	  };

	  $scope.toggleContactSelected = function(character)  {
	    var contacts = $scope.filterContactsForChar(character);
	    var selected = !_.every(contacts, function(contact) {
	      return $scope.isContactSelected(character, contact);
	    });
	    _.each(contacts, function(contact)  {
	      $scope.contactSetSelected(character, contact, selected);
	    });
	  };

	  $scope.getContactSelectedInfo = function(character)  {
	    return _.filter($scope.filterContactsForChar(character), function(contact) {
	      return $scope.isContactSelected(character, contact);
	    }).length + ' / ' + _.filter(character.contacts, function(contact) {
	      return $scope.isContactSelected(character, contact);
	    }).length;
	  };

	  $scope.getContactSelectedClass = function(character)  {
	    var groups = _.groupBy($scope.filterContactsForChar(character), function(contact) {
	      return $scope.isContactSelected(character, contact) ? '1' : '0';
	    });
	    return _.keys(groups).length != 1
	      ? 'edit'
	      : (groups['1'] != null
	          ? 'check'
	          : 'unchecked');
	  };

	  $scope.contactTypes = [
	    {name: 'Character', text: 'Char'},
	    {name: 'Corporation', text: 'Corp'},
	    {name: 'Alliance', text: 'Ally'}
	  ];
	  $scope.standings = ['-10', '-5', '0', '5', '10'];

	  $scope.filter = {};
	  _.each(['Source', 'Target'], function(type) {
	    var filter = {
	      search: '',
	      contactType: {},
	      flags: {
	        watched: false,
	        blocked: false
	      },
	      standing: {}
	    };
	    _.each($scope.contactTypes, function(contactType) {
	      filter.contactType[contactType.name] = true;
	    });
	    _.each($scope.standings, function(standing) {
	      filter.standing[standing] = true;
	    });
	    $scope.filter[type] = filter;
	  });

	  $scope.getFilter = function(contact)  {
	    return $scope.filter[contact.type];
	  };

	  $scope.filterContactsForChar = function(character)  {
	    return $scope.filterContacts(character.contacts, $scope.getFilter(character));
	  };
	  


	  $scope.filterContacts = function(contacts, filter)  {
	    var search = filter.search.toLocaleLowerCase();
	    return _.filter(contacts, function(contact)  {
	      return filter.contactType[ contact.contactType ]
	        && (search == '' || contact.contact.name.toLocaleLowerCase().indexOf(search) != -1)
	        && filter.standing[ contact.standing ]
	        && (!filter.flags.watched || contact.watched)
	        && (!filter.flags.blocked || contact.blocked);
	    });
	  };

	  var postContact = function(contacts, destType, action) {
	    if(_.findWhere($scope.characters, {type: destType}).contacts == null) return;
	    contacts = _.map(contacts, function(contact)  {
	      contact = _.clone(contact);
	      delete contact.$$hashKey;
	      return contact;
	    });
	    $http({
	      method: 'POST',
	      data: {contacts: JSON.stringify(contacts), destType: destType},
	      url: '/contact/' + action
	    }).then(function()  {
	      updateData();
	    });
	  };

	  $scope.del = function(character)  {
	    var contactsToCopy = _.filter(character.contacts, function(contact)  {
	      return $scope.isContactSelected(character, contact);
	    });
	    postContact(contactsToCopy, character.type, 'del');
	  };

	  $scope.update = function(character, contact)  {
	    postContact([contact], character.type, 'add');
	  };

	  $scope.copy = function(character)  {
	    var contactsToCopy = _.filter(character.contacts, function(contact)  {
	      return $scope.isContactSelected(character, contact);
	    });
	    var destType = _.find($scope.characters, function(c) {
	      return c.type != character.type;
	    }).type;
	    postContact(contactsToCopy, destType, 'add');
	  };

	  $scope.$on('$destroy', function() {
	    updateDataInterval();
	  });
	});
})(angular)