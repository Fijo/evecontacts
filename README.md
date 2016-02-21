# evecontacts

How to setup a own server that runs evecontacts?
checkout this repo

inside of the repo execute the folowing commands:

npm install

cd site/
../node_modules/.bin/bower install

cd ..


Use your favorite text editor to create a text file named .apiKey in the repository root.

goto https://developers.eveonline.com/applications and create a new application

chose CREST Access for connection type and in the permissions section add CharacterContactsRead and CharacterContactsWrite to the "Requested Scopes List".
Set the callback url up to be http://{your hostname}:3000/

Once you created your application put the "Secret Key" into the .apiKey file.

To start the server execute
node main.js
