var sudo = require('sudo-prompt');
var child_process = require('child_process');
var started = false;
var localAddress;
var iface;
let bwfiles = undefined;
let bwfile_i = 0;
let nbwfile_i = 0;
let tracePath;


const fs = require('fs');
let lineReader = undefined;
let lines = []
let line_i = 0;
let pipeId = 0;

let MIN_LINES_CNT = 10;

let cmd = 'sudo pfctl -E';
child_process.execSync(cmd);


process.on('message', (arg) => {
    var msg;
    if (arg.mtype === 'start'){
        started = true;
        localAddress = arg.localAddress;
        iface = arg.iface;
        msg = `STARTED BW shaping interface for ${arg.pathType} on ${arg.localAddress}, with trace path = ${arg.tracePath}`;
        tracePath = arg.tracePath;
        pipeId = arg.pipeId;
        console.log(msg);

        fs.readdir(arg.tracePath, function(err, items) {
            // console.log(items);
            bwfiles = items;
            let bwfile = arg.tracePath+'/'+bwfiles[bwfile_i];
            lineReader = require('readline').createInterface({
                input: require('fs').createReadStream(bwfile)
            });
            lineReader.on('line', function (line) {

                lines.push(line);
                // console.log('Line from file:', line);
            });

            lineReader.on('close', () =>{
                nbwfile_i = (bwfile_i + 1) % bwfiles.length;
                console.log(`File ${bwfiles[bwfile_i]} is loaded, setting the next file to ${bwfiles[nbwfile_i]}`);
            });
        });
    }
    else if (arg.mtype === 'stop'){
        started = false;
         msg = `STOPPED BW shaping interface for ${arg.pathType} on ${arg.localAddress}, with trace path = ${arg.tracePath}`;
        // console.log(msg)
    }
    process.send(msg);
});

let counter = 0;

setInterval(() => {
    // process.send({ counter: counter++ });
    var newBWVal = lines.splice(0,1)[0];
    if (newBWVal){
        // set new BW value
        let kbps = Math.ceil(parseFloat(newBWVal));
        let cmd = `sudo dnctl pipe ${pipeId} config bw ${kbps}kbit/s`;
        console.log(`Setting new BW value to ${kbps} on iface ${iface}, CMD= ${cmd}`);
        child_process.execSync(cmd);
    }
    if (lines.length < MIN_LINES_CNT){
        // if only few lines left, read the next trace file
        bwfile_i = nbwfile_i;
        lineReader = require('readline').createInterface({
            input: require('fs').createReadStream(tracePath+'/'+bwfiles[bwfile_i])
        });
        lineReader.on('line', function (line) {

            lines.push(line);
            // console.log('Line from file:', line);
        });
        lineReader.on('close', () =>{
            nbwfile_i = (bwfile_i + 1) % bwfiles.length;
            console.log(`File ${bwfiles[bwfile_i]} is loaded, setting the next file to ${bwfiles[nbwfile_i]}`);
        });
    }

}, 1000);