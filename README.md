# noxiousChatBot
echoBot for [noxious instant messaging application](https://github.com/mattcollier/noxious).
##Features
This bot will automatically accept a contact request sent to it.  Subsequently,
it will echo any chat messages back to the sender.
##Data Files
All data files for the bot are store in a folder called 'noxiousData' that will
be created under the application folder on initial start-up.  This folder
contains lists of registered contacts as well as the RSA key the bot uses for
encryption/decryption/signing.  Persistent data relating to tor and the hidden
service can be found in 'noxiousData/ths-data'.  One may delete the noxiousData
folder entirely in order to reset and regenerate all new keys and a new tor
hidden service name.
##Crypto
All encryption/decryption/signing in the bot is performed by native openssl
libraries via the [ursa module](https://github.com/quartzjer/ursa).  The
noxious instant messaging application utilizes the JavaScript
[forge module](https://github.com/digitalbazaar/forge) for crypto, so the bot
serves to test compatibility for the crypto functions.
##Installation
You will need a working npm and iojs installation and a node-gyp toolchain.  
Clone this repository.
```
npm install
npm start
```
