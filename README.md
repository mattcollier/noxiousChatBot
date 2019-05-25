# noxiousChatBot
echoBot for [noxious instant messaging application](https://github.com/mattcollier/noxious).
## Features
This bot will automatically accept a contact request sent to it.  Subsequently,
it will echo any chat messages back to the sender.
## Data Files
All data files for the bot are store in a folder called 'noxiousData' that will
be created under the application folder on initial start-up.  This folder
contains lists of registered contacts as well as the RSA key the bot uses for
encryption/decryption/signing.  Persistent data relating to tor and the hidden
service can be found in 'noxiousData/ths-data'.  One may delete the noxiousData
folder entirely in order to reset and regenerate all new keys and a new tor
hidden service name.
## Crypto
All encryption/decryption/signing in the bot is performed by native openssl
libraries via the [ursa module](https://github.com/quartzjer/ursa).  The
noxious instant messaging application utilizes the JavaScript
[forge module](https://github.com/digitalbazaar/forge) for crypto, so the bot
serves to test compatibility for the crypto functions.
## OS Dependencies
### Linux
```
apt-get install tor build-essential libssl-dev git
```
### OSX
```
brew install openssl
brew install tor
brew install git
```
## Installation
You will need a working npm and iojs installation.
### pangyp
The [pangyp module](https://www.npmjs.com/package/pangyp) is a fork of the
[node-gyp module](https://www.npmjs.com/package/node-gyp) that include io.js
support.  pangyp is a cross-platform command-line tool written in Node.js for
compiling native addon modules for io.js
```
npm install pangyp -g
```
## Clone and Build
```
git clone https://github.com/mattcollier/noxiousChatBot.git
cd noxiousChatBot
npm install
cd node_modules/ursa
pangyp rebuild
cd ../..
```
*note:* You should see 'gyp OK' at the end of the 'pangyp rebuild' process.  This
means that the native code compiled properly.
## Users Guide
After you see the Noxious Client ID diplayed in the console, wait about 30 seconds
for your hidden service to fully publish on the Tor network.  After that, you
may send a contact request to the bot.  The bot will automatically accept your
request.  Once the bot becomes available as a contact in your Noxious Client, you
may send messages that will be echoed back to you.
### Start the Bot
From the noxiousChatBot folder do:
```
npm start
```
*note:* The bot uses the same ports as the noxious application so it will need
to operate on a different machine/ip.
### Stopping the Bot
Use Ctrl-C to stop the bot.  This will gracefully shut down the Tor process as well.
