# evecontacts


## Live demo/ hosted version/ howots

[http://f1jo.mooo.com:3000/](http://f1jo.mooo.com:3000/)

[![Introduction video/ tutorial](http://img.youtube.com/vi/bEc1xSzgrFQ/0.jpg)](https://www.youtube.com/watch?v=bEc1xSzgrFQ)



## How to setup an own server that runs evecontacts?
checkout this repo

inside of the repo execute the folowing commands:

npm install

cd site/
../node_modules/.bin/bower install

cd ..



Goto https://developers.eveonline.com/applications and create a new application.

Chose CREST Access for connection type and in the permissions section add CharacterContactsRead and CharacterContactsWrite to the "Requested Scopes List".
Set the callback url up to be http://{your hostname}:3000/

Use your favorite text editor to create 2 text files named .apiKey and .clientId in the repository root.
Once you created your application put the "Secret Key" into the .apiKey file and the "Client ID" into the .clientId file.

To start the server execute
node main.js



## About the project
started a couple days after the relase of the [API Chalange Dev Blog](https://community.eveonline.com/news/dev-blogs/the-eve-online-api-challenge-1/)