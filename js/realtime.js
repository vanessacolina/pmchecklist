/*
  DriveRT
  Handle synchronization with Google Drive using the realtime API.

  version: 0.2
  author: Alessio Franceschelli - @AleFranz - alessio@franceschelli.me
  
  This code is released under the terms of the MIT license (http://opensource.org/licenses/MIT)
*/

/* global gapi */
"use strict";

var Realtime = Realtime || {};

Realtime.Controller = function(view) {
  this.view = view;
  this.uxchecklist = null;
  this.fileId = null;
};

Realtime.Controller.prototype.log = (document.location.hostname == "localhost" && Function.prototype.bind)
  ? Function.prototype.bind.call(console.log, console)
  : function() {};

Realtime.Controller.prototype.isLoaded = function() {
  return this.uxchecklist != null;
};

Realtime.Controller.prototype.loaded = function(result) {
  var model = result.getModel();
  this.uxchecklist = model.getRoot().get('uxchecklist');
  this.log(this.uxchecklist);
  this.log(this.uxchecklist.version);

  var self = this;
  this.uxchecklist.checkboxes.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function(value){
    self.log(value);
    if (!value.isLocal)
    {
      var key = value.property;
      var val = value.newValue;
      self.log("changed " + key + " as " + val);
      self.view.checkboxes[key].setChecked(val);
    }
  });

  var keys = this.uxchecklist.checkboxes.keys();
  this.log(keys);
  for (var i=0; i < keys.length; i++) {
    var key = keys[i];
    var val = this.uxchecklist.checkboxes.get(key);
    this.log("loaded " + key + " as " + val);
    this.view.checkboxes[key].setChecked(val);
  }
  this.log("ready!");
};

Realtime.Controller.prototype.onCheckBoxChange = function(key) {
  var value = this.view.checkboxes[key].isChecked();
  this.log("saved " + key + " as " + value);
  this.uxchecklist.checkboxes.set(key, value);
};

Realtime.Controller.prototype.start = function(title, ids, defaultTitle) {
  var self = this;
  if (ids) {
    self.fileId = ids;
    self.open(ids);
  } else {
    this.listFiles(function (files){
      title = title || (files.length > 0 ? files[0].title : defaultTitle);
      log(title);
      self.openFile(title, function (file) {
        self.fileId = file.id;
        self.open(file.id);
      });
    });
  }
};

Realtime.Controller.prototype.open = function(id) {
  var self = this;
  self.fileId = id;
  gapi.drive.realtime.load(id,
    function(r) {
        log(r);
        self.listFiles(function (files){
          self.view.fileList.set(
            files.map(function(file) {return file.title;}),
            files.filter(function(file){return file.id == id;})[0].title,
            id
            );
          self.loaded(r);
        });
    },
    function(model) { self.initializeModel(model, false); });
};

Realtime.Controller.prototype.initializeModel = function(model) {
  var uxchecklist = model.create(Realtime.Model.UxCheckList);
  model.getRoot().set('uxchecklist', uxchecklist);
  uxchecklist.version = 1;
  uxchecklist.checkboxes = model.createMap();
  this.log(uxchecklist.version);
  this.save(uxchecklist);
};

Realtime.Controller.prototype.save = function(uxchecklist) {
  uxchecklist = uxchecklist || this.uxchecklist;
  for(var key in this.view.checkboxes) {
    var cb = this.view.checkboxes[key];
    var value = cb.isChecked();
    uxchecklist.checkboxes.set(key, value);
    this.log("saved " + key + " as " + value);
  }
};

Realtime.Controller.prototype.rename = function(newTitle, success) {
  var body = {'title': newTitle};
  var request = gapi.client.drive.files.patch({
    'fileId': this.fileId,
    'resource': body
  });
  request.execute(function(resp) {
    log('New Title: ' + resp.title);
    success(resp.title);
  });
}

Realtime.Controller.prototype.init = function() {
  gapi.drive.realtime.custom.registerType(Realtime.Model.UxCheckList, 'UxCheckList');
  Realtime.Model.UxCheckList.prototype.version = gapi.drive.realtime.custom.collaborativeField('version');
  Realtime.Model.UxCheckList.prototype.checkboxes = gapi.drive.realtime.custom.collaborativeField('checkboxes');
};

Realtime.Controller.prototype.auth = function(immediate, success, fail, title, defaultTitle) {
  var self = this;
  gapi.auth.authorize({
    'client_id': '939842792990-97uqc8rc3h645k65ecd4j7p3u0al17aj.apps.googleusercontent.com',
    'scope': 'https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.file email profile',
    'immediate': immediate, 
    'cookie_policy': 'single_host_origin'
  }, function(r) { console.log(r); self.checkAuth(r, success, fail, title, defaultTitle); });
};

Realtime.Controller.prototype.checkAuth = function(authResult, success, fail, title, ids, defaultTitle) {
  if (authResult && !authResult.error) {
    this.log(authResult);
    success();
    this.start(title, ids, defaultTitle);
  } else {
    fail();
  }
};

Realtime.Controller.prototype.openFile = function(title, callback) {
  var self = this;
  gapi.client.load('drive', 'v2', function () {
    var mimeType = 'application/vnd.google-apps.drive-sdk';
    gapi.client.drive.files.list({'q': "title = '" + title + "' and trashed = false" })
      .execute(function(r){
        self.log(r);
        if (!r || r.items.length < 1) {
          self.log("create");
          gapi.client.drive.files.insert({
            'resource': {
              mimeType: mimeType,
              title: title
            }
          }).execute(callback);
        } else {
          var file = r.items[0];
          self.log(file);
          callback(file);
        }
      });
  });
};

Realtime.Controller.prototype.listFiles = function(callback) {
  var self = this;
  gapi.client.load('drive', 'v2', function () {
    gapi.client.drive.files.list({'q': "trashed = false" })
      .execute(function(r){
        self.log(r);
        var files = r.items;
        self.log(files);
        callback(files);
      });
  });
};

Realtime.View = function(fileList, checkboxes) {
  this.fileList = fileList;
  this.checkboxes = checkboxes;
};

Realtime.Model = Realtime.Model || {};

Realtime.Model.UxCheckList = function () {};

Realtime.Model.CheckBox = function(id, element, isCheckedFn, setCheckedFn) {
  this.id = id;
  this.element = element;
  this.isCheckedFn = isCheckedFn;
  this.setCheckedFn = setCheckedFn;
};

Realtime.Model.CheckBox.prototype.isChecked = function() {
  return this.isCheckedFn(this.id, this.element);
};

Realtime.Model.CheckBox.prototype.setChecked = function(val) {
  this.setCheckedFn(this.id, this.element, val);
};

Realtime.Model.FileList = function(element, setTitles) {
  this.element = element;
  this.setTitles = setTitles;
  this.titles = [];
  this.selectedTitle = null;
  this.fileId = null;
};

Realtime.Model.FileList.prototype.set = function(titles, selectedTitle, fileId) {
  log(selectedTitle);
  this.titles = titles;
  this.selectedTitle = selectedTitle;
  this.fileId = fileId;
  this.setTitles(this.titles, this.selectedTitle, this.fileId, this.element);
};
