"use strict";

var
  fs = require('fs'),
  dataDir = __dirname + '/noxiousData';

var mkdirSync = function (path) {
    try {
      fs.mkdirSync(path);
    } catch(e) {
      if ( e.code != 'EEXIST' ) throw e;
    }
  }

mkdirSync(dataDir);

var
  Path = require('path'),
  http = require('http'),
  DataFile = require('./DataFile'),
  // communications functions
  NoxiousClient = require('./NoxiousClient'),
  myNoxClient = new NoxiousClient(),
  // cononical json.stringify
  // This is used to stringify objects in a consistent way prior to hashing/signing
  jsStringify = require('canonical-json'),
  contactList = new DataFile(Path.join(dataDir, 'Contacts.json')),
  contactRequestList = new DataFile(Path.join(dataDir, 'ContactRequests.json')),
  thsBuilder = require('ths'),
  ths = new thsBuilder(dataDir),
  NoxiousCrypto = require('./NoxiousCrypto'),
  myCrypto = new NoxiousCrypto({ path: Path.join(dataDir, 'PrivateKey.json') }),
  dataTransmitDomain = require('domain').create(),
  contactRequestDomain = require('domain').create(),
  myAddress;

console.log('[main] dataDir: ', dataDir);

dataTransmitDomain.on('error', function(err){
  console.log(err);
  notifyCommError(err.code);
});

contactRequestDomain.on('error', function(err){
  console.log(err);
  notifyCommError(err.code);
  updateRequestStatus(err.domainEmitter['_dstaddr'], 'failed');
});

function isValidTorHiddenServiceName (name) {
  let toReturn = false;
  if (name.search(/^[a-zA-Z2-7]{16}\.onion$/) != -1) {
    // it matched
    toReturn = true;
  }
  return toReturn;
}

function updateRequestStatus(contactAddress, status, updateGui) {
  if(updateGui === undefined) {
    updateGui = false;
  }
  let tmpContact = contactRequestList.get(contactAddress);
  tmpContact.status=status;
  contactRequestList.set(contactAddress, tmpContact);
  if (updateGui) {
    // do nothing
    //getContactRequests();
  }
}

function fixPem(pemData) {
  return pemData.replace(/\r/gm,"");
}

function buildEncryptedMessage(destAddress, msgText) {
  let tmpCrypto = new NoxiousCrypto({ 'pubPem': contactList.get(destAddress).pubPem });
  let msgContent = {};
  msgContent.type = 'message';
  msgContent.from = myAddress;
  msgContent.to = destAddress;
  msgContent.msgText = msgText;
  let msgObj = {};
  msgObj.content = msgContent;
  // sign using my private key
  msgObj.signature = myCrypto.signString(jsStringify(msgContent));
  // encrypt using recipients public key
  let encryptedData = tmpCrypto.encrypt(JSON.stringify(msgObj));
  let encObj = {};
  encObj.content = { type: 'encryptedData', clearFrom: myAddress, data: encryptedData};
  encObj.protocol = '1.0';
  return encObj;
}

function buildContactRequest(destAddress) {
  let introObj = {};
  introObj.type = 'introduction';
  introObj.from = myAddress;
  introObj.to = destAddress;
  introObj.pubPem = myCrypto.pubPem;
  let msgObj = {};
  msgObj.content = introObj;
  // msgObj.signature = new Buffer(myCrypto.signString(jsStringify(introObj)), 'binary').toString('base64');
  msgObj.signature = myCrypto.signString(jsStringify(introObj));
  msgObj.protocol = '1.0';
  return msgObj;
}

function transmitContactRequest(destAddress) {
  contactRequestDomain.run(function() {
    myNoxClient.transmitObject(destAddress, buildContactRequest(destAddress), function(res) {
      switch(res.status) {
        case 200:
          updateRequestStatus(destAddress, 'delivered');
          break;
        case 409:
          updateRequestStatus(destAddress, 'failed');
          var msgObj = {};
          msgObj.method = 'error';
          var failedReason = res.body['reason'];
          switch (failedReason) {
            case 'EKEYSIZE':
              msgObj.content = { type: 'contact',
                message: 'The contact request was rejected because your public encryption key is not proper.  Please upgrade your Noxious software.'};
              break;
            case 'EPROTOCOLVERSION':
              msgObj.content = { type: 'contact',
                message: 'The contact request was rejected because the message format is not proper.  Please upgrade your Noxious software.'};
              break;
            default:
              msgObj.content = { type: 'contact',
                message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
              break;
          }
          console.log('[transmitContactRequest] Error:', msgObj);
          break;
      }
    });
  });
}

var server = http.createServer(function (req, res){
  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello world!');
  } else if (req.method === 'POST') {
    if (req.url === '/') {
      var reqBody = '';
      req.on('data', function(d) {
        reqBody += d;
        if (reqBody.length > 1e7) {
          res.writeHead(413, 'Request Entity Too Large', {'Content-Type': 'text/html'});
          res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>');
        }
      });
      req.on('end', function() {
        console.log('[HTTP Server] ', reqBody );
        let status = preProcessMessage(reqBody);
        if (status.code == 200) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify( { status: 'OK' }));
          processMessage(reqBody);
        } else {
          res.writeHead(status.code, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ reason: status.reason }));
        }
      });
    }
  }
});
server.listen(1111, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1111');

function registerContactRequest(req) {
  var tmpObj = {};
  tmpObj.pubPem = req.pubPem  ;
  tmpObj.contactAddress = req.from;
  // check for dups in requests list and contact list
  if(!contactRequestList.has(req.from) && !contactList.has(req.from)) {
    // this is a new incoming contact Request
    console.log('[contact] New Contact Request Received');
    tmpObj.direction = 'incoming';
    contactRequestList.set(req.from, tmpObj);
    // chatBot is going to automatically accept any valid contact request.
    updateRequestStatus(tmpObj.contactAddress, 'sending', false);
    contactRequestDomain.run(function() {
      myNoxClient.transmitObject(tmpObj.contactAddress, buildContactRequest(tmpObj.contactAddress), function(res) {
        if(res.status == 200) {
          contactList.set(tmpObj.contactAddress, { pubPem: contactRequestList.get(tmpObj.contactAddress).pubPem, contactAddress: tmpObj.contactAddress });
          contactRequestList.delete(tmpObj.contactAddress);
        } else if (res.status == 409) {
          // this can occur in a case where a successfully transmitted contact
          // request is deleted before a reply is sent.
          updateRequestStatus(content.contactAddress, 'failed');
          var msgObj = {};
          msgObj.method = 'error';
          var failedReason = res.body['reason'];
          switch (failedReason) {
            case 'EKEYSIZE':
              msgObj.content = { type: 'contact',
                message: 'The contact request was rejected because your public encryption key is not proper.  Please upgrade your Noxious software.'};
              break;
            default:
              msgObj.content = { type: 'contact',
                message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
              break;
          }
          console.log(msgObj);
        }
      });
    });
  } else if(contactRequestList.get(req.from)) {
    console.log('[contact] Contact request is from an existing contact.');
  }
}

function preProcessMessage(msg) {
  // default statusCode = forbidden;
  var status = {};
  status.code = 403;
  status.reason = '';
  var msgObj = JSON.parse(msg);
  console.log('[preProcessMessage] Start');
  // TODO this function should verify message integrity
  if (msgObj.protocol === '1.0') {
    if (msgObj.content !== undefined) {
      var content = msgObj.content;
      if (content.type !== undefined) {
        switch (content.type) {
          case 'introduction':
            if (content.from !== undefined && content.from && isValidTorHiddenServiceName(content.from)) {
              if(!contactList.has(content.from) && !contactRequestList.has(content.from)) {
                // we don't know this person already, intro is OK
                status.code = 200;
              } else if (contactRequestList.has(content.from) &&
                contactRequestList.get(content.from)['direction'] == 'outgoing' &&
                contactRequestList.get(content.from)['status'] == 'delivered') {
                // we're expecting to hear back from this person, intro is OK
                status.code = 200;
              } else {
                // contact request (key exchange) process needs to be repeated.
                status.code = 409;
              }
            }
            if (status.code == 200) {
              // so far so good, but now check the pubkey, reset status code
              status.code = 403;
              var minKeySize = 3072;
              var tmpCrypto = new NoxiousCrypto({ 'pubPem': fixPem(content.pubPem) });
              var keySize = tmpCrypto.keySize;
              console.log('[preProcessMessage] The key size is ', keySize, 'bits.');
              if (keySize < minKeySize) {
                console.log('[preProcessMessage] The key must be at least ', minKeySize, ' bits');
                status.code = 409;
                status.reason = 'EKEYSIZE';
              } else {
                console.log('[preProcessMessage] The key size meets the ', minKeySize, 'bit requirement');
                status.code = 200;
              }
            }
            break;
          case 'encryptedData':
            if (content.clearFrom !== undefined && content.clearFrom && isValidTorHiddenServiceName(content.clearFrom)) {
              if(contactList.has(content.clearFrom)) {
                // this is from an existing contact, it's OK
                status.code = 200;
              } else {
                // there is no public key for this contact
                status.code = 410;
              }
            }
            break;
        }
      }
    } else {
      // protocol version mismatch
      console.log('[preProcessMessage] Protocol version mismatch.');
      status.code = 409;
      status.reason = 'EPROTOCOLVERSION';
    }
  }
  return status;
}

function processMessage(msg) {
  var msgObj = JSON.parse(msg);
  //console.log('[process message] ', msgObj);
  var content = msgObj.content;
  switch (content.type) {
    case 'introduction':
      var signature = msgObj.signature;
      var tmpCrypto = new NoxiousCrypto({ 'pubPem': fixPem(content.pubPem) });
      if (tmpCrypto.signatureVerified(jsStringify(content), signature)) {
        console.log('[processMessage] Introduction is properly signed.');
        // TODO enhance from address checking, for now, not null or undefined, and not myAddress
        if (content.to==myAddress && content.from!==undefined && content.from && content.from!==myAddress) {
          // content.to and content.from are part of the signed content.
          console.log('[processMessage] Introduction is properly addressed.');
          registerContactRequest(content);
        }
      } else {
        console.log('[processMessage] Introduction is NOT properly signed.  Disregarding.');
      }
      break;
    case 'encryptedData':
      //var decObj = JSON.parse(myCrypto.decrypt(content.data));
      myCrypto.decrypt(content.data, function(err, rawJson) {
        if(!err) {
          var decObj = decObj = JSON.parse(rawJson);
          var content = decObj.content;
          var signature = decObj.signature;
          // TODO additional integrity checks?
          if (content.to && content.to == myAddress && content.from && isValidTorHiddenServiceName(content.from) && content.type && content.msgText) {
            if (contactList.has(content.from)) {
              switch (content.type) {
                case 'message':
                  var tmpCrypto = new NoxiousCrypto({'pubPem': contactList.get(content.from).pubPem});
                  if (tmpCrypto.signatureVerified(jsStringify(content), signature)) {
                    console.log('[processMessage] Message is properly signed.');
                    if (content.to==myAddress && content.from!==undefined && content.from && content.from!==myAddress) {
                      console.log('[processMessage] Message is properly addressed.');
                      var msgObj = {};
                      msgObj.method = 'message';
                      msgObj.content = { type:'message', from: content.from, msgText: content.msgText };
                      console.log('[processMessage] Message:', msgObj);
                      // chatBot sends an immediate response with the same message.
                      echoMessage(msgObj.content);
                    }
                  } else {
                    console.log('[processMessage] Message is NOT properly signed.  Disregarding.');
                  }
                  break;
              }
            }
          }
        }
      });
      break;
  }
}

function echoMessage(msgObj) {
  let content = {};
  content.destAddress = msgObj.from;
  content.msgText = msgObj.msgText;
  var encObj = buildEncryptedMessage(content.destAddress, content.msgText);
  dataTransmitDomain.run(function() {
    myNoxClient.transmitObject(content.destAddress, encObj, function(res) {
      var msgObj = {};
      switch(res.status) {
        case 200:
          // OK
          msgObj.method = 'message';
          msgObj.content = { type: 'status', status: 'delivered', msgId: content.msgId };
          console.log('[echoMessage] Message:', msgObj);
          break;
        case 410:
          // recipient does not have the public key (anymore)
          msgObj.method = 'error';
          msgObj.content = { type: 'message',
            message: 'The recipient no longer has you in their contact list.  Delete the contact, then send a contact request.'};
          console.log('[echoMessage] Error:', msgObj);
          msgObj.method = 'message';
          msgObj.content = { type: 'status', status: 'failed', msgId: content.msgId };
          // do nothing with this msgObj;
          break;
        case 409:
          var failedReason = res.body['reason'];
          switch (failedReason) {
            case 'EPROTOCOLVERSION':
              msgObj.method = 'error';
              msgObj.content = { type: 'message',
                message: 'The message was rejected because the message format is not proper.  Please upgrade your Noxious software.'};
              console.log('[echoMessage] Error:', msgObj);
              msgObj.method = 'message';
              msgObj.content = { type: 'status', status: 'failed', msgId: content.msgId };
              // do nothing with this msgObj right now
              break;
          }
          break;
      }
    });
  });
}

function startHiddenService() {
  // we know that tor is loaded and web page is loaded.
  var serviceList = ths.getServices();
  console.log('Service List: %j',serviceList);

  function noxiousExists(element) {
    return element.name=='noxious';
  }

  var noxiousProperties = serviceList.filter(noxiousExists);
  if (noxiousProperties==0) {
    // does not exist, create it
    console.log('Creating new noxious service');
    ths.createHiddenService('noxious','1111');
    ths.saveConfig();
    // TODO does not work propery on initial startup without workaround
    // https://github.com/Mowje/node-ths/issues/3
    // Why this?  https://github.com/Mowje/node-ths/issues/5
    var myDelegate = function() {
      ths.signalReload();
    }
    setTimeout(myDelegate, 25);
  }
  ths.getOnionAddress('noxious', function(err, onionAddress) {
    if(err) {
      console.error('[getOnionAddress] Error while reading hostname file: ' + err);
    }
    else {
      console.log('[getOnionAddress] Onion Address is: ', onionAddress);
      myAddress = onionAddress;
      console.log('[Noxious Chat ID]', myAddress.split('.')[0]);
    }
  });
}

// track ths / tor bootstrapping
ths.on('bootstrap', function(state) {
  console.log('[torBootstrapping] ', state);
});

ths.start(false, function () {
  console.log("tor Started!");
  startHiddenService();
});

process.on('SIGINT', function() {
  if (ths.isTorRunning()) {
    ths.stop(function () {
      process.exit();
    });
  }
});
