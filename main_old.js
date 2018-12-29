// Modules to control application life and create native browser window
if (process.env.NODE_ENV !== 'production'){
    require('longjohn');
}

const {app, BrowserWindow,ipcMain} = require('electron');
var http = require('https'),
    net = require('net'),
    dns = require('dns'),
    util = require('util'),
    url = require('url'),
    stringifyObject = require('stringify-object'),
    request = require('request'),
    ffi = require('ffi-napi');

const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const debug = util.debuglog('net');

var SOL_SOCKET = 1;
var SO_BINDTODEVICE = 25;
var current = ffi.Library(null, {
    'setsockopt': ['int', ['int', 'int', 'int', 'string', 'int']]
});

var errno = ffi.Library(null,{'perror':['void',['string']]});

function bindingAgent(options) {
    console.log("our binding agent constructor is called");
    http.Agent.call(this, options);
    this.createConnection = bindingCreateConnection;
}

// Ubuntu Linux ifconfig
// const ifaces = ['enp0s3','enp0s8'];
// const ips = ['192.168.1.112','192.168.1.120'];
// const ips = ['192.168.2.49','192.168.2.50'];

//MacOS ifconfig
const ifaces = ['en0','en8'];
const ips = ['192.168.1.118','192.168.1.110'];

var req_cnt = 0;

util.inherits(bindingAgent, http.Agent);

function bindingCreateConnection(options, callback) {
    //TODO: fall back to net.connection upon option

    // debug("our custom create connection is called ", stringifyObject(options));
    // console.log('got options: '+ stringifyObject(options) + ' , \n callback : ' + callback);
    var socket;
    if_i = 1;

    const ourIp = ips[if_i];
    const ourInterface = ifaces[if_i];

    socket = new net.Socket();
    // socket = new net.Socket({handle: net._createServerHandle(ourIp)});
    // var iface = ourInterface;
    // var r = current.setsockopt(socket._handle.fd, SOL_SOCKET, SO_BINDTODEVICE, iface, iface.length);
    //
    // if (r === -1){
    //     console.log(current);
    //     errno.perror('setsockopt: ');
    //     throw new Error("getsockopt(SO_BINDTODEVICE) error");
    // }

    //create tcp socket option
    const tcpSocketOpts = {
        port:options.port,
        family: 4,
        localAddress:ourIp,
        host:options.host
    };
    debug(`tcpSoecketOptions: ${stringifyObject(tcpSocketOpts)}`)
    socket.connect(tcpSocketOpts,callback);

    return socket;
}

ipcMain.on('asynchronous-message', (event, arg) => {
  // console.log(arg) // prints "ping"
  event.sender.send('asynchronous-reply', {msg:'pong'})
});

ipcMain.on('request-download', (event, arg) => {
    var quality = arg.quality;

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

    // const reqHeaders = {
    //     'Host':vUrl.host,
    //     'User-Agent': 'curl/7.61.0',
    //     'Accept':'*/*'
    // };

    const if_i = req_cnt++ % 2;

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
        // createConnection: bindingCreateConnection,
        host:vUrl.host,
        auth: vUrl.auth,
        slashes:vUrl.slashes,
        protocol: vUrl.protocol
    };
    // console.log(arg);
    // console.log('request-onload : ' + arg.httpreq.onload);
    var chunck_cnt = 0;
    var totalbytes = 0;
    var vbuf = undefined;
    // var getparam = arg.url;
    var getparam = options;
    var req = http.get(getparam, function(response) {
        startTime = new Date().getTime();
        // console.log(`STATUS: ${response.statusCode}`);
        // console.log(`RSP: ${stringifyObject(response)}`);
        // console.log(`RSP-HEADERS: ${stringifyObject(response.headers)}`);

        console.log('Start download time: ' + startTime);

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
            const endTime = new Date().getTime();
            const duration = (endTime - startTime) / 1000;
            const bitsLoaded = vbuf.length * 8;
            const bps = (bitsLoaded / duration).toFixed(2);
            const kbps = (bps / 1024).toFixed(2);
            const mbps = (kbps / 1024).toFixed(2);
            console.log(`total bytes downloaded = ${totalbytes} , vbuf.length = ${vbuf.length}`);
            console.log('End download time: ' + endTime + ', kbps = ' + kbps);


            console.log(`Status? ${response.statusCode} , ${response.statusMessage}`);
            // console.log(`Complete? ${response.complete}`);
            // console.log(stringifyObject(response.headers));
            // console.log(stringifyObject(req.getHeaders()));
            event.sender.send('request-download-end', {req_id:arg.req_id, resp:response, databuf:vbuf});

        });
    });

    req.on('socket', (s)=>{

        // s.on('lookup', (err, ip, addressType, host) =>{
        //     console.log('DNS lookup: ip : ' + ip + ', host : ' + host + ', addressType : ' + addressType + ' , err : ' + err);
        // });

        s.on('connect',() =>{
            console.log('socket assigned, s.address = ' + stringifyObject(s.address()) +
                ', localAddress = ' + s.localAddress + `, remote address = ${s.remoteAddress}`);
        });


        // s.on("close", function() {
        //     console.log("socket closed");
        // });
    });

    req.on("error", function(err) {
        console.log("an error ocurred", err);
    });
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function checkDownloadSpeedRequest(options, fileSize) {
    let startTime;
    console.log('In checkDownloadSpeed (request) : ' + options.path);
    //using request
    startTime = new Date().getTime();
    return new Promise((resolve, _) => {
        var req = request(options, (error, response, _) => {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode);

            const endTime = new Date().getTime();
            const duration = (endTime - startTime) / 1000;
            const bitsLoaded = fileSize * 8;
            const bps = (bitsLoaded / duration).toFixed(2);
            const kbps = (bps / 1024).toFixed(2);
            const mbps = (kbps / 1024).toFixed(2);

            console.log('End download time: ' + endTime + ', kbps = ' + kbps);
            if (response){
                console.log('In response, socket address = ' + stringifyObject(response.socket.address()) +
                    ' localAddress = ' + response.socket.localAddress);
            }

            resolve({bps, kbps, mbps});
        });


    }).catch((error) => {
        e = new Error(error);
        throw e;
    });
}

function checkDownloadSpeed(options, fileSize){
    let startTime;
    console.log('In checkDownloadSpeed : '+ options.path + ' , from host: ' +options.host);
    var chunck_cnt = 0;
    //using http
    return new Promise((resolve, _) => {

        var req = http.request(options, function(response) {
            startTime = new Date().getTime();
            console.log(`STATUS: ${response.statusCode}`);
            console.log(`RSP-HEADERS: ${JSON.stringify(response.headers)}`);

            console.log('Start download time: ' + startTime);

            response.on('data', (chunk) => {
                console.log("got some data : " + (chunck_cnt++) );
            });

            response.on('end', () => {
                const endTime = new Date().getTime();
                const duration = (endTime - startTime) / 1000;
                const bitsLoaded = fileSize * 8;
                const bps = (bitsLoaded / duration).toFixed(2);
                const kbps = (bps / 1024).toFixed(2);
                const mbps = (kbps / 1024).toFixed(2);
                console.log('End download time: ' + endTime + ', kbps = ' + kbps);
                resolve({bps, kbps, mbps});
            });

            console.log('In response, socket address = ' + stringifyObject(response.socket.address()) +
                ' localAddress = ' + response.socket.localAddress);

        });

        console.log(`REQ-HEADERS: ${stringifyObject(req.getHeaders())}`);

        req.on('socket', (s)=>{
            console.log('socket assigned, address = ' + stringifyObject(s.address()) +
            ', localAddress = ' + s.localAddress);

            s.on('lookup', (err, ip, addressType, host) =>{
                console.log('DNS lookup: ip : ' + ip + ', host : ' + host + ', addressType : ' + addressType + ' , err : ' + err);
            });


            s.on("close", function() {
                console.log("socket closed");
            });
        });

        req.on("error", function(err) {
            console.log("an error ocurred", err);
        });

        process.on('uncaughtException', function(err) {
            console.log("uncaughtException");
            console.error(err.stack);
        });
        req.end();
        return req;
    })
    .catch((error) => {
      e = new Error(error);
      throw e;
    });
};

async function testDownloadSpeed() {
    // const baseUrl = 'http://ipv4.download.thinkbroadband.com/5MB.zip';
    // const baseUrl = {
    //     hostname: 'ipv4.download.thinkbroadband.com',
    //     path: '/5MB.zip',
    //     localAddress: ifaces[0]
    // };

    var optionsAgent = {};
    var ourBindingAgent = new bindingAgent(optionsAgent);

    var tc_https = {
        host:'dash.akamaized.net',
        pathname:'/dash.akamaized.net/dash264/TestCases/1c/qualcomm/2/BBB_720_1M_video_0.mp4',
        url:'https://dash.akamaized.net/dash264/TestCases/1c/qualcomm/2/BBB_720_1M_video_0.mp4',
        port:433,
        protocol:'https:'
    };

    var tc_http = {
        host:'dash.akamaized.net',
        pathname:'/dash.akamaized.net/dash264/TestCases/1c/qualcomm/2/BBB_720_1M_video_0.mp4',
        url:'http://dash.akamaized.net/dash264/TestCases/1c/qualcomm/2/BBB_720_1M_video_0.mp4',
        port:80,
        protocol:'http:'
    };

    var fileSize=673792;
    var tc_httpbin = {
        host:'httpbin.org',
        pathname:'/httpbin.org/stream-bytes/'+fileSize,
        url:'http://httpbin.org/stream-bytes/'+fileSize,
        headers: {
            'accept':'application/octet-stream',
            'Referer': 'http://qadah.thamir.com/',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
        },
        gzip: true,
        port:80,
        protocol:'http:'
    };

    var tc_httpbin_ip = {
        host:'34.248.41.77',
        pathname:'/34.248.41.77/stream-bytes/'+fileSize,
        url:'http://34.248.41.77/stream-bytes/'+fileSize,
        port:80,
        protocol:'http:'
    };


    http://shielded-plains-39953.herokuapp.com/
    var tc_heroku = {
        host:'shielded-plains-39953.herokuapp.com',
        pathname:'/shielded-plains-39953.herokuapp.com/',
        url:'http://shielded-plains-39953.herokuapp.com'+fileSize,
        port:80,
        headers: null,
        protocol:'http:'
    };
    // var tc = tc_https;
    var tc = tc_httpbin;
    // var tc = tc_httpbin_ip;
    // var tc = tc_heroku;


    //No DNS Lookup

    dns.resolve4(tc.host, (err, addresses) => {
        console.log('addresses : ' + addresses);
    });
    var req = {
        uri: tc.url,
        host: tc.host,
        servername: tc.host,
        port: tc.port,
        protocol: tc.protocol,
        method: 'GET',
        slashes: true,
        headers: tc.headers,
        localAddress: ips[1],
        gzip: tc.gzip,
        // createConnection: net.createConnection,
        // createConnection: bindingCreateConnection,
        // agent: null,
        // agent: http.globalAgent,
        // agent: ourBindingAgent,
        href: tc.url,
        pathname: tc.pathname
    };

    // checkDownloadSpeed(req, fileSize).then((speed) => {
    //     console.log(speed);
    // });

    //DNS lookup
    // dns.lookup(tc.host, (err,address,family) =>{
    //     console.log('ip: ' + address);
    //     var req = {
    //         uri: tc.url,
    //         host: address,
    //         servername: tc.host,
    //         port: tc.port,
    //         protocol: tc.protocol,
    //         method: 'GET',
    //         slashes: true,
    //         header: tc.headers,
    //         // gzip:true,
    //         agent: null,
    //         createConnection: bindingCreateConnection,
    //         // agent: http.globalAgent,
    //         // agent: ourBindingAgent,
    //         path:null,
    //         href: tc.url,
    //         pathname: tc.pathname
    //     };
    //
    //     checkDownloadSpeed(req, fileSize).then((speed) => {
    //         console.log(speed);
    //     });
    //
    // });

    // var baseUrl = 'http://eu.httpbin.org/stream-bytes/' + fileSize;
    // req = tc.url;

    // console.log('req : '+ stringifyObject(req));


    // checkDownloadSpeedRequest(req, fileSize).then((speed) => {
    //     console.log(speed);
    // });

    // const baseUrl = {
    //   hostname: 'eu.httpbin.org',
    //   path: '/stream-bytes/50000000',
    //   agent: ourBindingAgent
    // };
    // var baseUrl = 'http://eu.httpbin.org/stream-bytes/50000000';
    // var fileSize = 500000;

}

process.on('uncaughtException', function (err) {
    console.error(err.stack);
});

function createWindow () {
    // for (let i = 0; i < 1; i++) {
    //     testDownloadSpeed();
    // }

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

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
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
