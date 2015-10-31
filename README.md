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
In addition to the encryption offered by the tor hidden service protocol, all chat messages are
RSA public-key encrypted using a 3072 bit key.  All crytography is handled by the [forge module](https://github.com/digitalbazaar/forge).  Although forge is 100%
JavaScript, it does access the CSPRNG (Cryptographically Secure Random Number
Generator) provided by the native openssl library via a call to [node's crypto.randomBytes
function](https://iojs.org/api/crypto.html#crypto_crypto_randombytes_size_callback).
## OS Dependencies
### Linux
```
apt-get install tor git
```
### OSX
```
brew install tor
brew install git
```
## Installation
You will need a working npm installation.

## Clone and Build
```
git clone https://github.com/mattcollier/noxiousChatBot.git
cd noxiousChatBot
npm install
```
## Users Guide
After you see the Noxious Client ID displayed in the console, wait about 30 seconds
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
