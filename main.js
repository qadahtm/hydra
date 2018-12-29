// Modules to control application life and create native browser window
if (process.env.NODE_ENV !== 'production'){
    require('longjohn');
}

const {app, BrowserWindow,ipcMain} = require('electron');
var http = require('https'),
    net = require('net'),
    util = require('util'),
    url = require('url'),
    fs = require('fs'),
    stringifyObject = require('stringify-object');

const { PerformanceObserver, performance } = require('perf_hooks');
const debug = util.debuglog('net');

// Ubuntu Linux ifconfig
// const ifaces = ['enp0s3','enp0s8'];
// const ips = ['192.168.1.112','192.168.1.120'];
// const ips = ['192.168.2.49','192.168.2.50'];

//MacOS ifconfig
const ifaces = ['en0','en8'];
const ips = ['192.168.1.118','192.168.1.110'];

// const traces = [
//     fs.realpathSync('./bwprofiles_fcc'),
//     fs.realpathSync('./bwprofiles_LTE')
// ];

const traces = [
    fs.realpathSync('./bwprofiles_DSL'),
    fs.realpathSync('./bwprofiles_LTE')
];



const { fork } = require('child_process');

const bwshaper_wifi = fork('bwshaper.js');

bwshaper_wifi.on('message', (msg) => {
    console.log('Message from child', msg);
});

bwshaper_wifi.send({ mtype:'start',localAddress: ips[0], tracePath: traces[0],iface:ifaces[0], pipeId:1, pathType:'Wifi'});

const bwshaper_lte = fork('bwshaper.js');
bwshaper_lte.on('message', (msg) => {
    console.log('Message from child', msg);
});

bwshaper_lte.send({ mtype:'start', localAddress: ips[1], tracePath: traces[1], iface:ifaces[1], pipeId:2, pathType:'LTE'});


var req_cnt = 0;


// IPC Main process events
ipcMain.on('asynchronous-message', (event, arg) => {
  // console.log(arg) // prints "ping"
  event.sender.send('asynchronous-reply', {msg:'pong'})
});


async function processDownloadRequest(event,arg){
    var quality = arg.quality;
    let startTime;
    // let startTime = performance.now();

    // for chunk in  arg.chunks:
    /// chunk = arg.chunks[
    // set range in HTTP header
    // var startByte = chunk.startByte;
    // var endByte = chunk.endByte;

    // var link = chunk.link;
    // var url = arg.url;

    var vUrl = url.parse(arg.url);
    // console.log(stringifyObject(vUrl));

    const reqHeaders = {
        'accept':'application/octet-stream',
        'Referer': 'http://qadah.thamir.com/',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
    };

    // const if_i = req_cnt++ % 2;
    if_i = 0;
    let lte_path = (if_i !== 0);

    http = vUrl.protocol === 'http:'? require('http'): require('https');

    var options = {
        href:vUrl.href,
        headers: reqHeaders,
        gzip: true,
        localAddress: ips[if_i],
        path:vUrl.path,
        pathname:vUrl.pathname,
        query: vUrl.query,
        search: vUrl.search,
        hash: vUrl.hash,
        hostname: vUrl.hostname,
        port:443,
        host:vUrl.host,
        auth: vUrl.auth,
        slashes:vUrl.slashes,
        protocol: vUrl.protocol
    };

    var totalbytes = 0;
    var vbuf = undefined;
    // var getparam = arg.url;
    var getparam = options;

    var req = http.get(getparam, function(response) {

        // console.log(`STATUS: ${response.statusCode}`);
        // console.log(`RSP: ${stringifyObject(response)}`);
        // console.log(`RSP-HEADERS: ${stringifyObject(response.headers)}`);

        response.on('data', (chunk) => {
            const clen = chunk.length;
            totalbytes += clen;

            if (vbuf === undefined){
                vbuf = chunk;
            }
            else{
                vbuf = Buffer.concat([vbuf,chunk]);
            }

            // console.log("got some data : chuck # " + (chunck_cnt++) + ', with type = ' + typeof chunk + `, clength = ${clen}`);
            // console.log(decoder.write(chunk));
            // event.sender.send('request-download-data',{req_id:arg.req_id, chunk:chunk});
        });

        response.on('end', () => {
            // const endTime = new Date().getTime();
            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000;
            const bitsLoaded = vbuf.length * 8;
            const bps = (bitsLoaded / duration).toFixed(2);
            const kbps = (bps / 1024).toFixed(2);
            const mbps = (kbps / 1024).toFixed(2);
            console.log(`Total bytes downloaded (${vUrl.pathname}) = ${totalbytes} over ${lte_path? 'LTE':'WiFi'}, speed = ${kbps} kbps`);

            // console.log(`Status? ${response.statusCode} , ${response.statusMessage}`);
            // console.log(`Complete? ${response.complete}`);
            // console.log(stringifyObject(response.headers));
            // console.log(stringifyObject(req.getHeaders()));
            event.sender.send('request-download-end', {req_id:arg.req_id, resp:response, databuf:vbuf, lte:lte_path, kbps:kbps});

        });
    });

    req.on('socket', (s)=>{

        // s.on('lookup', (err, ip, addressType, host) =>{
        //     console.log('DNS lookup: ip : ' + ip + ', host : ' + host + ', addressType : ' + addressType + ' , err : ' + err);
        // });

        s.on('connect',() =>{
            // console.log('socket assigned, s.address = ' + stringifyObject(s.address()) +
            //     ', localAddress = ' + s.localAddress + `, remote address = ${s.remoteAddress}`);
            // startTime = new Date().getTime();
            startTime = performance.now();
            // console.log('Start download time: ' + startTime);
        });


        // s.on("close", function() {
        //     console.log("socket closed");
        // });
    });

    req.on("error", function(err) {
        console.log("an error ocurred", err);
    });
}

ipcMain.on('request-download', (event, arg) => {
    processDownloadRequest(event,arg);
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow


process.on('uncaughtException', function (err) {
    console.error(err.stack);
});

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1024, height: 720})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
