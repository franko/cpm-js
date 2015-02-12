
var list_tonumber = function(row) {
    for (var i = 0; i < row.length; i++) {
        var x = Number(row[i]);
        if (!isNaN(x) && row[i] != "") {
            row[i] = x;
        }
    }
};

var csvReader = function(text) {
    var lines = text.split("\n");
    var i = 0;
    var next = function() {
        if (i < lines.length) {
            var row = lines[i++].replace("\r", "").split(",");
            list_tonumber(row);
            return row;
        }
    }
    return {next: next};
};

var generalTags = ['RECIPE', 'MEAS SET', 'SITE'];
// var sectionTags = ['LOT ID', 'SLOT', 'WAFER ID', 'RCP CNT'];
var sectionTags = ['SLOT', 'Tool', 'Reprod'];

var collectTag = function(tag) {
    return generalTags.indexOf(tag) >= 0 || sectionTags.indexOf(tag) >= 0;
};

var tagsDoMatch = function(tagList, a, b) {
    for (var k = 0; k < tagList.length; k++) {
        var key = tagList[k];
        if (a[key] !== b[key]) {
            return false;
        }
    }
    return true;
};

FXParser = function(text, extended) {
    this.reader = csvReader(text);
    this.tables = [];
};

FXParser.prototype = {
    readDateTime: function() {
        for (var row = this.next(); row; row = this.next()) {
            if (!row[0]) break;
            if (row[0].indexOf('COLLECTION DATE/TIME:') >= 0) {
                return row.length > 1 ? row[1] : "";
            }
        }
        return "";
    },

    readMeasurements: function(attrs) {
        var meas = [];
        var gr = this.groupRepeat;
        for (var row = this.next(); row; row = this.next()) {
            if (!row[0]) break;
            var n = row[0];
            var data;
            if (gr) {
                data = [(n-1) % gr + 1, Math.floor((n-1) / gr) + 1];
                data.concat(row.slice(1, -3));
            } else {
                data = row.slice(0, -3);
            }
            meas.push(attrs.concat(data));
        }
        return meas;
    },

    mergeMeasurements: function(info, meas, headers) {
        for (var i = 0; i < this.tables.length; i++) {
            var table = this.tables[i];
            if (tagsDoMatch(generalTags, table.info, info)) {
                for (var j = 0; j < meas.length; j++) {
                    table.meas.push(meas[j]);
                }
                return;
            }
        }
        var lookup = {"SLOT": "Wafer", "Site #": "Site"}
        var fullHeaders = sectionTags.map(function(d) { return lookup[d] || d; });
        if (this.groupRepeat) {
            fullHeaders.push("Repeat");
        }
        fullHeaders.concat(headers);
        var resultHeaders = headers.slice(1);
        this.tables.push({info: info, meas: meas, headers: fullHeaders, resultHeaders: resultHeaders});
    },

    readSection: function(info) {
        var headers;
        for (var row = this.next(); row; row = this.next()) {
            var key = row[0];
            if (key === "RESULT TYPE") {
                headers = row.slice(0, -1);
                headers[0] = "Site #";
            } else if (collectTag(key)) {
                info[key] = row[1];
            } else if (key == "Site #") {
                var rowTags = sectionTags.map(function(d) { return info[d]; });
                var meas = this.readMeasurements(rowTags);
                this.mergeMeasurements(info, meas, headers);
                return true;
            }
        }
        return false;
    },

    readAll: function(info) {
        while (this.readSection(info)) { }
    },

    next: function() { return this.reader.next(); }
};
