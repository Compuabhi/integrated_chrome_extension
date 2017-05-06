// Muaz Khan     - https://github.com/muaz-khan
// MIT License   - https://www.WebRTC-Experiment.com/licence/
// Source Code   - https://github.com/muaz-khan/Chrome-Extensions

(function() {
    var runtimePort = chrome.runtime.connect({
        name: location.href.replace(/\/|:|#|\?|\$|\^|%|\.|`|~|!|\+|@|\[|\||]|\|*. /g, '').split('\n').join('').split('\r').join('')
    });
    // to check if the events for controlling
    // videos are done
    var doneAddingEvents = false;

    let cameraElement = {
        video: {},
        localStream:  {},
        accessCamera: function() {
            addElementToHtml();
            video = document.getElementById('video');
            let url = window.location.href;
            url = url.substring(0, 8);

            console.log(url);
            
            if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // Not adding `{ audio: true }` since we only want video now
                navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
                    localStream = stream;
                    video.src = window.URL.createObjectURL(stream);
                    video.play();
                }).catch(function(err) {
                    console.log(err);
                    sendMessageToPopup({
                        failed: true,
                        camera: true,
                        error: err,
                        url: window.location.href
                    });
                });
            }
        },
        addElementToHtml: function() {
            let div = document.createElement('div');
            div.id ="extensionVideoContainer";
            div.style = "position: fixed!important;z-index: 999999999 !important;border-radius: 50% 50%;overflow: hidden !important;width: 300px!important;height: 300px!important;display: inline-block!important;bottom: 0!important;"
            let video = document.createElement('video');
            video.id = "video";
            video.style ="position: absolute;height: 300px !important; widht: 400px !important; left: -75px !important; max-width: 300% !important;";
            div.appendChild(video);
            document.body.appendChild(div);
        },
        endstream: function() {
            if (video) {
                video.pause();
                video.src = "";
                localStream.getTracks()[0].stop();
            }
        }
    };

    var peer;
    var vodRecorder;

    runtimePort.onMessage.addListener(function(message) {
        console.log(message);

        if (!message || !message.messageFromContentScript1234) {
            return;
        }

        if(location.href.indexOf(message.url) == -1) {
        	return;
        }

        if (message.sdp) {
            console.log("sdp")
            peer.setRemoteDescription(new RTCSessionDescription(message.sdp));
            return;
        }

        if (message.captureCamera) {
            cameraElement.accessCamera();
            return;
        }

        if (message.stopCamera) {
            cameraElement.endstream();
            return;
        }

        if (message.startCountdown) {
            startCountdown(message.duration);
        }

        if (message.loadingScreen) {
            loadinScreen();
        }

        if (message.clearLoadingScreen) {
            clearLoadingScreen();
        }

        if(message.giveMeMicrophone) {
            let stream, audioPlayer;

            navigator.mediaDevices.getUserMedia({
                audio: true
            }).then(function(s) {
                stream = s;

                audioPlayer = document.createElement('audio');
                audioPlayer.id = "el";
                audioPlayer.volume = 0;
                audioPlayer.src = (window.URL || window.webkitURL).createObjectURL(stream);
                (document.body || document.documentElement).appendChild(audioPlayer);
                audioPlayer.play();
                audioPlayer.muted = "muted";

                audioPlayer.onended = function() {
                    console.warn('Audio player is stopped.');
                };

                audioPlayer.onpause = function() {
                    console.warn('Audio player is paused.');
                };

                peer = new webkitRTCPeerConnection(null);

                peer.addStream(stream);

                peer.onicecandidate = function(event) {
                    if (!event || !!event.candidate) return;

                    runtimePort.postMessage({
                        sdp: peer.localDescription,
                        messageFromContentScript1234: true,
                        device: message.device
                    });
                };

                peer.oniceconnectionstatechange = function() {
                  if(!peer) return;

                    console.debug('ice-state', {
                        iceConnectionState: peer.iceConnectionState,
                        iceGatheringState: peer.iceGatheringState,
                        signalingState: peer.signalingState
                    });

                    if(stream && peer.iceConnectionState == 'failed' || peer.iceConnectionState == 'disconnected') {
                    	stream.getAudioTracks().forEach(function(track) {
                    		track.stop();
                    	});

                    	stream.getVideoTracks().forEach(function(track) {
                    		track.stop();
                    	});

                    	stream = null;
                    }
                };

                peer.createOffer(function(sdp) {
                    peer.setLocalDescription(sdp);
                }, function() {}, {
                    optional: [],
                    mandatory: {
                        OfferToReceiveAudio: false,
                        OfferToReceiveVideo: false,
                    }
                });
            }).catch(function(err) {
                console.log(err);
            });
            return;
        }

        if (message.stopStream) {
            // stream.getAudioTracks()[0].stop();
            // stream = null;

            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer = null;
            }

            if (peer) {
                peer.close();
                peer = null;
            }

            return;
        }
    });

    function removeWrapper() {
        $('.wrapper').remove();
    }

    function addElementToHtml() {
        let div = document.createElement('div');
        div.id ="extensionVideoContainer";
        div.style = "position: fixed!important;z-index: 999999999 !important;border-radius: 50% 50%;overflow: hidden !important;width: 250px!important;height: 250px!important;display: inline-block!important;bottom: 0!important; left: 0!important"
        let video = document.createElement('video');
        video.id = "video";
        video.style ="position: absolute;height: 250px !important; widht: 400px !important; left: -50px !important; max-width: 300% !important;";
        div.appendChild(video);
        document.body.appendChild(div);
    }

    function accessCamera() {
        addElementToHtml();
        let video = document.getElementById('video');

        // Get access to the camera!
        if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Not adding `{ audio: true }` since we only want video now
            navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
                video.src = window.URL.createObjectURL(stream);
                video.play();
            });
        }
    };

    function sendMessageToPopup(message) {
        chrome.runtime.sendMessage(message, function(response) {
            console.log(response);
        });
    };

    function blackScreen(duration) {
        let el = document.createElement('div');
        el.style.position = "fixed";
        el.style.zIndex = "99999";
        el.style.left = "0";
        el.style.right = "0";
        el.style.bottom = "0";
        el.style.top = "0";
        el.style.backgroundColor = "rgba(1,1,1,0.8)";
        el.style.fontSize  = "15rem";
        el.style.color = "#FFF";
        el.style.textAlign = "center";
        el.style.paddingTop = "21%";
        if (duration) {
            el.innerText = parseInt(duration) / 1000;
        }
        document.body.appendChild(el);

        return el;
    }

    function startCountdown(duration) {
        let el = blackScreen(duration);

        let interval  = setInterval(function() {
            let count_value = parseInt(el.innerText);

            if (count_value === 0) {
                el.remove();
                clearInterval(interval);
            } else {
                count_value--;
                el.innerText = count_value;
            }
            
        }, 1000)
    };

    function loadinScreen() {
        let el = blackScreen();
        el.id = "loaderforextension1234";
        el.style.padding = "0";
        el.style.display = "flex";
        el.style.alignItems = "center";

        let img =   document.createElement('img');
        img.src = "https://media.giphy.com/media/xUPGcjUhxMMUNwmD4Y/giphy.gif";
        img.style.position = "relative";
        img.style.margin = "auto";

        el.appendChild(img);
    }

    function clearLoadingScreen() {
        let loadingScreenElement = $("#loaderforextension1234");
        
        if (loadingScreenElement) {
            $(loadingScreenElement).remove();
        }
    }

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        console.log(message);

        if (message.action === "addInterface") {
            sendMessageToBackgroundScript({message: "tabData"});
            loadControls();
            return true;
        }

        return false;
    });
    function sendMessageToBackgroundScript(message_data) {
        chrome.runtime.sendMessage(
            message_data, 
            function(response) {
                console.log(response);
            }
        );
    }

    let open = false;

    function loadControls() {
        $.get(chrome.extension.getURL('html/videoControls.html'), function(data) {
            $($.parseHTML(data)).appendTo('body');
            setMarker();
        });
    }

    function setMarker() {
        let marker = $("#marker");

        marker.click(checkIfRecording);
    }

    function checkIfRecording() {

        if (open) {
            wrapperToggle();
            return;
        }
        chrome.runtime.sendMessage({
            action: "checkIfRecording"
        }, function(response) {
            console.log(response);
            if (response.val === "yes") {
                loadVideoControls(response.running);
            }

            wrapperToggle();
        });
    }

    function wrapperToggle() {
        let wrapper = $('.wrapper')[0];

        let videoControls = $('.videoControls')[0];

        if (videoControls && open) {
            videoControls.style.display = "none";
        }

        if (!open) {
            $(wrapper).animate({"right": '0px'});
        } else {
            $(wrapper).animate({"right": '-100px'});
        }
        
        open = !open;
    }

    function loadVideoControls(pauseOrResume) {
        let videoControls = document.getElementsByClassName('videoControls')[0];

        videoControls.style.display = "flex";

        if (!doneAddingEvents) {
            addEventToControls();
        }

        if (!pauseOrResume) {
            $('#pause')[0].style.display = "none";
            $('#resume')[0].style.display = "block";
        } else {
            $('#resume')[0].style.display = "none";
            $('#pause')[0].style.display = "block";
        }

        
    }

    function addEventToControls() {
        doneAddingEvents = true;
        let pause = $('#pause');

        pause.click(function() {
            chrome.runtime.sendMessage({'action': 'pauseRecording'}, function() {
                wrapperToggle();
            });
        });

        let resume = $('#resume');

        resume.click(function() {
            chrome.runtime.sendMessage({'action': 'resumeRecording'}, function() {
                wrapperToggle();
            });
        });

        let stop = $('#stop');

        stop.click(function() {
            console.log("stop");
            chrome.runtime.sendMessage({'action': 'stopRecording'}, function() {
                removeWrapper();
            });
        });

        let del = $('#delete');

        del.click(function() {
            chrome.runtime.sendMessage({'action': 'deleteRecording'}, function(response) {
                wrapperToggle();
            });
        });
    }
})();