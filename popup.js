  'use strict';

window.onload = init;

function init() {
  checkLogin();
  checkIfRecording();
}

function loadButton() {

  let tab = document.getElementById('tab');
  let options = document.getElementById("options");

  tab.addEventListener("click", recordTab);
  options.addEventListener("click", openOptions);
}

function loadVideoControls(status) {
  $($('.videoControlSection')[0]).fadeIn();

  let pause = $('#pause')[0];
  let resume = $('#resume')[0];
  let stop = $('#stop')[0];
  let del = $('#delete')[0];

  if (status) {
    $(resume).hide();
  } else {
    $(pause).hide();
  }

  pause.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'pauseRecording'
    }, function(response) {
      console.log(response);
      $('#pause').hide();
      $('#resume').fadeIn();
    })
  });

  resume.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'resumeRecording'
    }, function(response) {
      console.log(response);
      $('#resume').hide();
      $('#pause').fadeIn();
    });
  });

  stop.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'stopRecording'
    }, function(response) {
      console.log(response);
    });
  });

  del.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'deleteRecording'
    }, function(response) {
      console.log(response);
    });
  });
}

function checkLogin() {
  chrome.cookies.getAll({'domain': 'userstory.io', 'name': 'isAuthUserStory'}, function(cookie) {
    if(cookie[0].value === "63b998d4c603b42d140d60377c1beba893240744") {
      console.log("Loggedin");
      removeLoader();
    }
  });
};

function getUserInfo(cb) {
  chrome.storage.sync.get("data", function(data) {
    cb(JSON.parse(data.data));
  });
}

function loginGoogle() {
  chrome.runtime.sendMessage({login: true, google: true}, function(response) {
    console.log(response);
    var user = JSON.parse(response);
    printError("Welcome " + user.given_name);
    removeLoader();
  });
}

function recordTab() {
  getTabId(function(tabId) {
    chrome.runtime.sendMessage({record: "tab", id: tabId.id}, function(response) {
      console.log(response);
    });
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function getTabId(callback) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabArray) {
    callback(tabArray[0]);
  });
}

function printError(message) {
  let err = document.getElementById("errorPanel");
  err.innerText = message;

  return ;
}

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.failed) {
      if (message.camera) {
        let url = message.url;
        url = url.substring(0, 8);
        console.log(message);
        if (url.search("https://") !== -1) {
          printError("Something is wrong with the camera");
        } else {
          printError("For voice recording and camera the website needs to be of secure origin. Please try a https website.")
        }
      }
    }
  }
);

function removeLoader() {
  let loader = document.getElementsByClassName("wrapper");
  loader = loader[0];
  loader.remove();
}

function checkIfRecording() {
  chrome.runtime.sendMessage({
    action: "checkIfRecording"
  }, function(response) {
    if (response.val === "no") {
      loadButton();
    } else {
      loadVideoControls();
    }
  });
}

function loadVideoControls() {
  $("#tab").remove();
  $('#alert').text("you are currently recording");
}
