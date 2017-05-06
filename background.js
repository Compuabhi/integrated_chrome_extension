// Muaz Khan     - https://github.com/muaz-khan
// MIT License   - https://www.WebRTC-Experiment.com/licence/
// Source Code   - https://github.com/muaz-khan/Chrome-Extensions
// this page is using desktopCapture API to capture and record screen
// http://developer.chrome.com/extensions/desktopCapture.html
chrome.browserAction.setIcon({
    path: 'images/main-icon.png'
});

let extensionScreenCapture = {};
let running = true;
let videoConnection = null;
let recordedTabID = null;
let videoRecorder = VideoRecorder;
let tabRecordingStatus = false;
// check recording status
let isRecording = false;

// Custom log function
function debugLog() {
    if (console) {
        console.log.apply(console, arguments);
    }
}

chrome.runtime.onInstalled.addListener(function (object) {
    chrome.tabs.create({url:"http://userstory.io/login"}, function (tab) {
        console.log("New tab launched");
    });
});

/** Source: http://stackoverflow.com/questions/3971841/how-to-resize-images-proportionally-keeping-the-aspect-ratio
  * Conserve aspect ratio of the orignal region. Useful when shrinking/enlarging
  * images to fit into a certain area.
  *
  * @param {Number} srcWidth Source area width
  * @param {Number} srcHeight Source area height
  * @param {Number} maxWidth Fittable area maximum available width
  * @param {Number} maxHeight Fittable area maximum available height
  * @return {Object} { width, heigth }
  */
function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    var ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    debugLog('Aspect ratio:', ratio);
    return { width: srcWidth * ratio, height: srcHeight * ratio };
}

// Capture video stream of tab, will pass stream back to sendResponse()
function captureTabVideo(senderTab) {
    console.log("captureTabVideo");

    // Sanity check, can only record one at a time
    if (videoConnection) 
    {
        console.log('ERROR: video stream already exists, cannot capture two at a time!');
    }



    var settings, width, height;

    settings = {};

    // Get video dimensions
    debugLog('Tab dimensions:', senderTab.width, senderTab.height);
    width = DEFAULT_VIDEO_WIDTH;
    height = DEFAULT_VIDEO_HEIGHT;
    debugLog('Video dimensions:', width, height);

    debugLog('Adjusting aspect ratio...');
    var fitSize = calculateAspectRatioFit(senderTab.width, senderTab.height, width, height);
    width = Math.ceil(fitSize.width);
    height = Math.ceil(fitSize.height);
    debugLog('New size:', width, height);

    // Get video settings
    var videoSettings = {
        mandatory: {
            minWidth: width,
            minHeight: height,
            maxWidth: width,
            maxHeight: height,
            minFrameRate: DEFAULT_VIDEO_FRAME_RATE,
            maxFrameRate: DEFAULT_VIDEO_FRAME_RATE,
            chromeMediaSource: 'tab'
        },
    };

    // Capture only video from the tab
    chrome.tabCapture.capture({
            audio: false,
            video: true,
            videoConstraints: videoSettings
        }, 
        function (localMediaStream) 
        {
            debugLog('tabCapture:', localMediaStream);

            // Send to active tab if capture was successful
            if (localMediaStream)
            {
                // Store stream for reference
                videoConnection = localMediaStream;

                // Start recording
                if (videoRecorder.start(videoConnection)) 
                {
                    recordedTabID = extensionScreenCapture.id;   // Track recorded tab id
                    chrome.browserAction.setBadgeText({
                        text: "REC",
                    });
                    chrome.browserAction.setBadgeBackgroundColor({
                        color: "#F00",
                    });
                    tabRecordingStatus = true;
                    isRecording = true;
                    running = true;
                }
                else    // Error starting recording
                {
                    console.log('ERROR: could not start video recorder');
                    videoConnection = null;
                }
            }
            else    // Failed
            {
                console.log("ERROR: could not capture video stream")
                console.log(chrome.runtime.lastError);
                videoConnection = null;
            }

            // Send to response
            chrome.tabs.sendMessage(senderTab.id, {
                request: 'videoRecordingStarted',
                stream: videoConnection
            });
        }
    );
}

// Stop video capture and build compiled .webm video file
// If callback DNE, send video to active page, otherwise pass along video to callback
// obtain the bob from this function and 
// will be used to send the xhr
function stopVideoCapture(senderTab, callback) {
    console.log("stopVideoCapture");

    // Clear recording state
    recordedTabID = null;
    chrome.browserAction.setBadgeText({
        text: "",
    });
    chrome.browserAction.setBadgeBackgroundColor({
        color: "#F00",
    });

    // Sanity check
    if (!videoConnection) 
    {
        videoConnection = null;
        chrome.tabs.sendMessage(senderTab.id, {
            request: 'videoRecordingStopped',
            sourceURL: null,
        });
        return;
    }

    // Stop video capture and save file
    var videoData = videoRecorder.stop();
    try {
        videoConnection.stop();
    } catch (exception) {
        console.log(exception);
    } finally {
        videoConnection = null;
    }

    // If output was bad, don't continue
    if (!videoData || !videoData.sourceURL) 
    {
        chrome.tabs.sendMessage(senderTab.id, {
            request: 'videoRecordingStopped',
            sourceURL: null,
        });
        return;
    }
    
    console.log(videoData);
    var file = new File([videoData.videoBlob], 'RecordRTC-' + (new Date).toISOString().replace(/:|\./g, '-') + '.webm', {
        type: 'video/webm'
    });

    var formData = new FormData();
    formData.append('video-filename', file.name);
    formData.append('video-file', file);

    sendMessageToContentScript({"loadingScreen": true, "messageFromContentScript1234": true});
    chrome.cookies.getAll({'domain': 'userstory.io', 'name': 'emailUserStory'}, function(cookie) {
        console.log(cookie[0].value);
        formData.append('email', cookie[0].value);
        xhr('http://userstory.io/uploadvideo/', formData, function(data) {
            //console.log(data['url']);
            sendMessageToContentScript({"clearLoadingScreen": true, "messageFromContentScript1234": true});
            var url = "http://userstory.io" + data['url'];

            chrome.tabs.create({url: url, selected: true});
            setDefaults();
            chrome.runtime.reload();

            askToStopExternalStreams();

            try {
                peer.close();
                peer = null;
            } catch (e) {

            };

            try {
                audioPlayer.src = null;
                mediaStremDestination.disconnect();
                mediaStremSource.disconnect();
                context.disconnect();
                context = null;
            } catch (e) {

            }
        });
    });
    
    isRecording = false;
    tabRecordingStatus = false;
}

// This will send the request to the tab
// which in return will send a message
// that will give us the dimensions of the tab
// and other related iformation required for recording
function captureTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(!tabs) {
            return ;
        }
        chrome.tabs.sendMessage(tabs[0].id, {action: "addInterface"}, 
            function(response) {
                console.log(response);
            }
        );
    });
}

// this function is not required
// this is for demo purpose only
// the blob obtained in the stopVideoCapture
// function will send the blob of the video
function stopCaptureTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        stopVideoCapture(tabs[0]);
    });
}

var recorder;

function askToStopExternalStreams() {
    sendMessageToContentScript({
        stopStream: true,
        messageFromContentScript1234: true
    });
}

var peer;

function xhr(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200) {
            callback(JSON.parse(request.responseText));
        }
    };
    request.open('POST', url);
    request.send(data);
}   

function pauseAllRecording() {
    VideoRecorder.pause();
}

function resumeAllRecording() {
    VideoRecorder.resume();
}

function stopScreenRecording() {
    if (tabRecordingStatus) {
        stopCaptureTab();
        return;
    }

    isRecording = false;
    recorder.stopRecording(function() {
        // recordRTC.getDataURL(function(dataURL) {
        //     video.src = dataURL;
        // });
        closeCameraAndStuff();
        var file = new File([recorder.getBlob()], 'RecordRTC-' + (new Date).toISOString().replace(/:|\./g, '-') + '.webm', {
            type: 'video/webm'
        });

        var formData = new FormData();
        formData.append('video-filename', file.name);
        formData.append('video-file', file);

        sendMessageToContentScript({"loadingScreen": true, "messageFromContentScript1234": true});
        chrome.cookies.getAll({'domain': 'userstory.io', 'name': 'emailUserStory'}, function(cookie) {
            console.log(cookie[0].value);
            formData.append('email', cookie[0].value);
            xhr('http://userstory.io/uploadvideo/', formData, function(data) {
                //console.log(data['url']);
                sendMessageToContentScript({"clearLoadingScreen": true, "messageFromContentScript1234": true});
                var url = "http://userstory.io" + data['url'];

                chrome.tabs.create({url: url, selected: true});
                setDefaults();
                chrome.runtime.reload();

                askToStopExternalStreams();

                try {
                    peer.close();
                    peer = null;
                } catch (e) {

                };

                try {
                    audioPlayer.src = null;
                    mediaStremDestination.disconnect();
                    mediaStremSource.disconnect();
                    context.disconnect();
                    context = null;
                } catch (e) {

                }
            });
        });
    });

    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');

    chrome.browserAction.setTitle({
        title: 'Record Screen'
    });
}

function setDefaults() {
    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });

    if (recorder && recorder.stream) {
        recorder.stream.stop();
        if (recorder && recorder.stream && recorder.stream.onended) {
            recorder.stream.onended();
        }
    }

    recorder = null;
    isRecording = false;
    imgIndex = 0;
}

var images = ['recordRTC-progress-1.png', 'recordRTC-progress-2.png', 'recordRTC-progress-3.png', 'recordRTC-progress-4.png', 'recordRTC-progress-5.png'];
var imgIndex = 0;
var reverse = false;

function onRecording() {
    chrome.browserAction.setIcon({
        path: 'images/' + images[imgIndex]
    });

    if (!reverse) {
        imgIndex++;

        if (imgIndex > images.length - 1) {
            imgIndex = images.length - 1;
            reverse = true;
        }
    } else {
        imgIndex--;

        if (imgIndex < 0) {
            imgIndex = 1;
            reverse = false;
        }
    }

    if (isRecording) {
        setTimeout(onRecording, 800);
        return;
    }

    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });
}

function setBadgeText(text) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        text: text + ''
    });
}

var initialTime, timer;

function checkTime() {
    if (!initialTime) return;
    var timeDifference = Date.now() - initialTime;
    var formatted = convertTime(timeDifference);
    setBadgeText(formatted);

    chrome.browserAction.setTitle({
        title: 'Recording duration: ' + formatted
    });
}

function convertTime(miliseconds) {
    var totalSeconds = Math.floor(miliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;

    minutes += '';
    seconds += '';

    if (minutes.length === 1) {
        // minutes = '0' + minutes;
    }

    if (seconds.length === 1) {
        seconds = '0' + seconds;
    }

    return minutes + ':' + seconds;
}

function getChromeVersion() {
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
    return raw ? parseInt(raw[2], 10) : 52;
}

var resolutions = {
    maxWidth: 29999,
    maxHeight: 8640
};
var aspectRatio = 1.77;
var audioBitsPerSecond = 0;
var videoBitsPerSecond = 0;

var enableTabAudio = false;
var enableMicrophone = false;
var audioStream = false;

var videoCodec = 'Default';
var videoMaxFrameRates = '';
var enableCamera = false;

var alreadyHadGUMError = false;

function sendMessageToContentScript(message) {
    try {
        message.url = runtimePort.sender.url;
        runtimePort.postMessage(message);
    } catch (e) {
        pending.push(message);
    }
}

function enableDisableContextMenuItems() {
    if(!runtimePort || !runtimePort.sender) return;
}

var runtimePort;
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.message === "tabData") {
        senderTab = sender.tab;
        let duration = 3000;
        startCountdown(duration);

        (function(senderTab){
            setTimeout(function() {
            captureTabVideo(senderTab)
        }, duration)})(senderTab);
        sendResponse({'recording': true})
    }
    if (message.record) {
        extensionScreenCapture.id = message.id;
        captureTab();

        return;
    } else if (message.request) {
        extensionScreenCapture.id = message.id;
        askContentScriptToCaptureCamera(message);

        return ;
    }

    if (message.login && message.google) {
        loginUsingGoogle(sendResponse);
        return true;
        
    } else if (message.action === "checkIfRecording") {
        console.log(isRecording);
        if (isRecording) {
            sendResponse({
                val: "yes",
                running: running
            });
        } else {
            sendResponse({
                val: "no",
                running: running
            });
        }
    } else if (message.action === "pauseRecording") {
        console.log(isRecording);
        console.log(running);
        if (isRecording && running) {
            pauseAllRecording();
            running = false;
            sendResponse("done");
        }
    } else if (message.action === "resumeRecording") {
        if (isRecording && !running) {
            resumeAllRecording();
            running = true;
            sendResponse("done");
        }
    } else if (message.action === "stopRecording") {
        if (isRecording) {
            stopScreenRecording();
            sendResponse("done");
            running = false;
        }
    } else if (message.action === 'deleteRecording') {
        if (isRecording) {
            setTimeout(function() {
                setDefaults();
                chrome.runtime.reload();
            }, 100);
        }
    }

    return false;
});

chrome.runtime.onConnect.addListener(function(port) {
    runtimePort = port;

    enableDisableContextMenuItems();

    runtimePort.onMessage.addListener(function(message) {
        console.log(message);
        if (!message || !message.messageFromContentScript1234) {
            return;
        }

        if (message.sdp) {
            createAnswer(message);
            return;
        }
    });

    if (pending.length) {
        pending.forEach(function(task) {
            sendMessageToContentScript(task);
        });
        pending = [];
    }
});

var pending = [];

function closeCameraAndStuff() {
    let id = extensionScreenCapture.id;

    chrome.tabs.update(id, {
        active: true
    }, function() {
        let message = {
            stopCamera: true,
            messageFromContentScript1234: true
        };

        sendMessageToContentScript(message);
    });
}

function startCountdown(duration) {
    chrome.tabs.update(extensionScreenCapture.id, {
        active: true
    }, function() {
        let message = {
            startCountdown: true,
            messageFromContentScript1234: true,
            duration: duration
        };

        sendMessageToContentScript(message);
    });
}

function askContentScriptToCaptureCamera(message1) {
    chrome.tabs.update(message1.id, {
        active: true
    }, function() {
        let message = {
            captureCamera: true,
            messageFromContentScript1234: true
        };

        sendMessageToContentScript(message);
    });
}

function askContentScriptToSendMicrophone(obj) {
    chrome.tabs.update(obj.id, {
        active: true
    }, function() {
        let message = {
            giveMeMicrophone: true,
            messageFromContentScript1234: true,
            device: obj.record
        };

        sendMessageToContentScript(message);
    });
}

function createAnswer(message) {
    let device = message.device;
    let sdp = message.sdp;
    peer = new webkitRTCPeerConnection(null);

    peer.onicecandidate = function(event) {
        if (!event || !!event.candidate) return;

        sendMessageToContentScript({
            sdp: peer.localDescription,
            messageFromContentScript1234: true
        });
    };

    peer.onaddstream = function(event) {
        audioStream = event.stream;

        captureTab();
    };

    peer.setRemoteDescription(new RTCSessionDescription(sdp));

    peer.createAnswer(function(sdp) {
        peer.setLocalDescription(sdp);
    }, function() {}, {
        optional: [],
        mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: false
        }
    });
}

var audioPlayer, context, mediaStremSource, mediaStremDestination;

function getId(id) {
    return id.toString().replace(/-|\.|_|'|"|\/|\\|\?/g, '');
}

function loginUsingGoogle(callback) {
    var retry = true;
    (function getTokenAndXhr(callback) {
        chrome.identity.getAuthToken({
            interactive: true
        }, function (token) {
            console.log(token);
            if (chrome.runtime.lastError) {
                callback(chrome.runtime.lastError);
                return;
            }

            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=' + token);
            xhr.onload = function () {
                if (this.status === 401 && retry) {
                  retry = false;
                  return;
                }

                chrome.storage.sync.set({"data": this.response}, function() {
                    console.log("settings saved");
                });

                console.log(this);
                callback(this.response);
            }
            xhr.send();
        });
    })(callback);
}

// Initiate download of something
function initiateDownload(filename, contentURL)
{
    //invokeSaveAsDialog(contentURL, filename);
    console.log('initiateDownload:', filename);

    // Create download link
    var link = document.createElement('a');
    link.href = contentURL;
    link.download = filename;
    document.body.appendChild(link);
    //link.click();
}