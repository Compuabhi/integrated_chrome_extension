// Required: js/third_party/whammy.js

/////////////////////////////////////////////////////////////////////////////
// Records video / frames from a LocalMediaStream, and then uses Whammy.js
//  to collate frames into a .webm video (no audio) for user consumption
//  Source: https://html5-demos.appspot.com/static/getusermedia/record-user-webm.html
window.VideoRecorder = (function()
{
    // Variables
    var RECORDING_FRAME_RATE = DEFAULT_VIDEO_FRAME_RATE || 60   // Frames per second
        , RECORDING_QUALITY = DEFAULT_VIDEO_QUALITY || 1.0
        , TIME_FRAME_DELAY = (1000 / RECORDING_FRAME_RATE).toFixed(1)
        , video = document.createElement('video')     // offscreen video
        , canvas = document.createElement('canvas') // offscreen canvas
        , rafId = null                  // Handle for animation request function
        , startTime = null              // Timer to track recording length
        , endTime = null                // Timer to track recording length
        , stream = null                 // Reference to video stream to record from
        , frames = []                   // Storage for video frames captured
        , recordedVideoURL = null       // Source url for last recorded video
    ;

    // Initialize recorder
    init();


    // Setup the video recorder
    function init() 
    {
        console.log('init()');

        document.querySelector('body').appendChild(video);
        video.autoplay = true;
        video.onloadedmetadata = function() 
        {
            console.log('video loaded!');

            video.width = video.clientWidth;
            video.height = video.clientHeight;
            canvas.width = video.width;
            canvas.height = video.height;

            console.log('video:', video);
            console.log('video dimensions:', video.width, video.height, video.clientWidth, video.clientHeight);

            // Begin recording
            record();
        };
    };

    // Start recording off the LocalMediaStream parameter from a getUserMedia()
    function start(localMediaStream) 
    {
        console.log('VideoRecorder : start()');

        if (!localMediaStream) 
        {
            console.log('ERROR: localMediaStream not defined!');
            return false;
        } 
        else if (stream)    // Can't record more than one
        {
            console.log('ERROR: already recording another video!');
            return false;
        }
        else {
            stream = localMediaStream;
        }

        // Set video source to begin loading video
        video.src = window.URL.createObjectURL(localMediaStream);

        return true;
    }

    // Begin actual recording of video frames
    function record()
    {
        console.log('VideoRecorder : record()');

        var ctx = canvas.getContext('2d');
        var CANVAS_HEIGHT = canvas.height;
        var CANVAS_WIDTH = canvas.width;

        frames = []; // clear existing frames;
        startTime = Date.now();

        /*
        function drawVideoFrame(time) 
        {
            // Draw video onto canvas, and read back canvas as webp
            ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            frames.push(canvas.toDataURL('image/webp', 1)); // image/jpeg is way faster :(
            console.log('push frame');

            rafId = requestAnimationFrame(drawVideoFrame);
        };
        rafId = requestAnimationFrame(drawVideoFrame);
        //*/
        
        // Frame redraw function
        rafId = setInterval(function() 
        {
            // Draw video onto canvas, and read back canvas as webp
            //  Unfortunately, image/jpeg is way faster :(
            ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            frames.push(canvas.toDataURL('image/webp', RECORDING_QUALITY));

        }, TIME_FRAME_DELAY);
        //*/
    };

    function pause() {
        clearInterval(rafId);
    }

    function resume() {
        var ctx = canvas.getContext('2d');
        var CANVAS_HEIGHT = canvas.height;
        var CANVAS_WIDTH = canvas.width;
        
        rafId = setInterval(function() 
        {
            // Draw video onto canvas, and read back canvas as webp
            //  Unfortunately, image/jpeg is way faster :(
            ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            frames.push(canvas.toDataURL('image/webp', RECORDING_QUALITY));

        }, TIME_FRAME_DELAY);
    }

    // Stop video recording and return source URL for compiled webm video
    function stop() 
    {
        console.log('VideoRecorder : stop()');

        // Stop recording
        //cancelAnimationFrame(rafId);
        clearInterval(rafId);
        endTime = Date.now();

        // Clean up stream
        try {
            window.URL.revokeObjectURL(video.src);
            stream.stop();
        } catch (exception) {
            console.log(exception);
        } finally {
            stream = null;
        }

        var duration = ((endTime - startTime) / 1000);
        console.log('frames: ' + frames.length + ' => ' + duration + 's video');

        // Sanity check
        if (!frames.length) 
        {
            console.log('ERROR: 0 frames captured!');
            return null;
        }

        // Compile our final binary video blob and create a source URL to it
        console.log('frame delay:', TIME_FRAME_DELAY);
        var videoBlob = whammy.fromImageArray(frames, TIME_FRAME_DELAY);
        recordedVideoURL = window.URL.createObjectURL(videoBlob);
        console.log('recordedVideoURL:', recordedVideoURL);

        // Cleanup
        frames = [];

        return {
            width: video.width,
            height: video.height,
            length: duration,
            sourceURL: recordedVideoURL,
            videoBlob: videoBlob
        };
    };

    // Download last recorded video
    function download()
    {
        console.log("VideoRecorder : download()");

        // Create download link
        var link = window.document.createElement('a');
        link.href = recordedVideoURL;
        link.download = 'video.webm';

        // Fire off fake click to trigger download
        var click = document.createEvent("Event");
        click.initEvent("click", true, true);
        link.dispatchEvent(click);
    }

    // Exposing functions
    return {
        start: start,
        stop: stop,
        download: download,
        pause: pause,
        resume: resume
    };
})();