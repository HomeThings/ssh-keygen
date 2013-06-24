var spawn = require('child_process').spawn;
var _ = require('underscore');
var fs = require('fs');
var os = require('os');
var path = require('path');

function checkAvailability(location, force, log, callback){
	var pubLocation = location+'.pub';
	log.debug('checking availability: '+location);
	fs.exists(location, function(keyExists){
		log.debug('checking availability: '+pubLocation);
		fs.exists(pubLocation, function(pubKeyExists){
			doForce(keyExists, pubKeyExists);
		});
	});
	function doForce(keyExists, pubKeyExists){
		if(!force && keyExists) return callback(location+' already exists');
		if(!force && pubKeyExists) return callback(pubLocation+' already exists');
		if(!keyExists && !pubKeyExists) return callback();
		if(keyExists){ 
			log.debug('removing '+location);
			fs.unlink(location, function(err){
				if(err) return callback(err);
				keyExists = false;
				if(!keyExists && !pubKeyExists) callback();
			});
		}
		if(pubKeyExists) {
			log.debug('removing '+pubLocation);
			fs.unlink(pubLocation, function(err){
				if(err) return callback(err);
				pubKeyExists = false;
				if(!keyExists && !pubKeyExists) callback();
			});
		}
	}
}
function ssh_keygen(location, opts, callback){
	opts = opts || {};

	var pubLocation = location+'.pub';
	if(!opts.comment) opts.comment = '';
	if(!opts.password) opts.password = '';
        if(!opts.quiet) opts.quiet = false;

        var args =  [ '-t', 'rsa'
                    , '-b', '2048'
                    , '-C', opts.comment
                    , '-N', opts.password
                    , '-f', location
	];
        if (opts.quiet) args.push('-q');

	var keygen = spawn('ssh-keygen', args);

	keygen.stdout.on('data', function(a){
		opts.log.info('stdout:'+a);
	});

	var read = opts.read;
	var destroy = opts.destroy;

	keygen.on('exit',function(){
		opts.log.info('exited');
		if(read){
			opts.log.debug('reading key '+location);
			fs.readFile(location, 'utf8', function(err, key){			
				if(destroy){
					opts.log.debug('destroying key '+location);
					fs.unlink(location, function(err){
						if(err) return callback(err);
						readPubKey();
					});
				} else readPubKey();
				function readPubKey(){
					opts.log.debug('reading pub key '+pubLocation);
					fs.readFile(pubLocation, 'utf8', function(err, pubKey){
						if(destroy){
							opts.log.debug('destroying pub key '+pubLocation);
							fs.unlink(pubLocation, function(err){
								if(err) return callback(err);
								return callback(undefined, { key: key, pubKey: pubKey });
							});
						} else callback(undefined, { key: key, pubKey: pubKey });
					});
				}
			});
		} else if(callback) callback();
	});

	keygen.stderr.on('data',function(a){
		opts.log.error('stderr:'+a);
	});
}

module.exports = function(opts, callback){
	var location = opts.location;
	if(!location) location = path.join(os.tmpDir(),'id_rsa');

	if(_.isUndefined(opts.read)) opts.read = true;
	if(_.isUndefined(opts.force)) opts.force = true;
	if(_.isUndefined(opts.destroy)) opts.destroy = true;
	if(_.isUndefined(opts.log)) {
          if(process.env.VERBOSE) { 
            opts.log = 
                  { error   : function(msg, props) { console.log(msg); console.trace(props.exception); }
                  , warning : function(msg, props) { console.log(msg); if (props) console.log(props);  }
                  , notice  : function(msg, props) { console.log(msg); if (props) console.log(props);  }
                  , info    : function(msg, props) { console.log(msg); if (props) console.log(props);  }
                  , debug   : function(msg, props) { console.log(msg); if (props) console.log(props);  }
                  };
          } else {
            opts.log = 
                  { error   : function(msg, props) {/* jshint unused: false */}
                  , warning : function(msg, props) {/* jshint unused: false */}
                  , notice  : function(msg, props) {/* jshint unused: false */}
                  , info    : function(msg, props) {/* jshint unused: false */}
                  , debug   : function(msg, props) {/* jshint unused: false */}
                  };
          }
        }

	checkAvailability(location, opts.force, opts.log, function(err){
		if(err){
			opts.log.error('availability err '+err);
			return callback(err);
		}
		ssh_keygen(location, opts, callback);
	});
};
