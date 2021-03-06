
var list_tonumber = function(row) {
    for (var i = 0; i < row.length; i++) {
        var x = Number(row[i]);
        if (!isNaN(x) && row[i] != "") {
            row[i] = x;
        }
    }
};

var csvLineSplit = function(line, sep) {
    var row = line.replace("\r", "").split(sep);
    if (row.length > 0 && row[row.length - 1].match(/^\s*$/)) {
        row.pop();
    }
    return row;
}

var findListSeparator = function(line) {
    var row_comma = csvLineSplit(line, ",");
    if (row_comma.length >= 2) {
        return ",";
    }
    var row_semi = csvLineSplit(line, ";");
    if (row_semi.length >= 2) {
        return ";";
    }
    throw "unknown format";
}

var csvReader = function(text) {
    var lines = text.split("\n");
    var i = 0;
    if (lines.length == 0) {
        throw "file is empty";
    }
    var sep = findListSeparator(lines[0]);
    var next = function() {
        if (i < lines.length) {
            var row = csvLineSplit(lines[i++], sep);
            list_tonumber(row);
            return row;
        }
    }
    return {next: next};
};

var generalTags = ['RECIPE', 'MEAS SET', 'SITE'];
var sectionTags = ['SLOT', 'Tool', 'Reprod', 'Time'];

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

var not_empty_string = function(s) {
    var ere = /^\s*$/;
    return (ere.exec(s) === null);
}

var clean_csv_string = function(s) {
    if (typeof(s) == "string") {
        s = s.replace(/^\s*"?/, "");
        return s.replace(/"?\s*$/, "");
    } else {
        return s;
    }
}

FXParser = function(text, options) {
    this.reader = csvReader(text);
    this.measSections = (options && options.sections) ? options.sections : [];
    if (options && options.groupRepeat) {
        this.groupRepeat = options.groupRepeat;
    }
};

FXParser.tablesDoMatch = function(ta, tb) {
    return tagsDoMatch(generalTags, ta.info, tb.info);
};

FXParser.prototype = {
    readDateTime: function() {
        for (var row = this.next(); row; row = this.next()) {
            if (!row[0]) break;
            if (row[0].indexOf('COLLECTION DATE/TIME:') >= 0) {
                if (row.length > 1) {
                    var datere = /(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/;
                    var m = datere.exec(row[1]);
                    if (m) {
                        var sec = Number(m[6]) + Number(m[5])*60 + Number(m[4]) * 3600 + Number(m[2]) * 24 * 3600;
                        return sec / 3600;
                    }
                }
            }
        }
        return 0;
    },

    readMeasurements: function(attrs, headers) {
        var meas = [];
        var col_start = 1, col_end = headers.length;
        var gr = this.groupRepeat;
        for (var row = this.next(); row; row = this.next()) {
            if (!row[0]) break;
            var n = row[0] - 1;
            var repeat_site;
            if (gr) {
                repeat_site = [(n % gr) + 1, Math.floor(n / gr) + 1];
            } else {
                repeat_site = row.slice(0, 1);
            }
            var data = repeat_site.concat(row.slice(col_start, col_end));
            meas.push(attrs.concat(data));
        }
        return meas;
    },

    mergeMeasurements: function(info, meas, headers) {
        for (var i = 0; i < this.measSections.length; i++) {
            var section = this.measSections[i];
            if (tagsDoMatch(generalTags, section.info, info)) {
                var tableElements = section.table.elements;
                for (var j = 0; j < meas.length; j++) {
                    tableElements.push(meas[j]);
                }
                return;
            }
        }
        var lookup = {"SLOT": "Wafer"}
        var fullHeaders = sectionTags.map(function(d) { return lookup[d] || d; });
        if (this.groupRepeat) {
            fullHeaders.push("Repeat");
        }
        fullHeaders = fullHeaders.concat(headers);
        var resultHeaders = headers.slice(1);
        var table = DataFrame.create(meas, fullHeaders);
        this.measSections.push({info: info, table: table, resultHeaders: resultHeaders});
    },

    readSection: function(measInfo) {
        var info = {Tool: measInfo.tool, Reprod: measInfo.reprod, Time: measInfo.time};
        var headers;
        for (var row = this.next(); row; row = this.next()) {
            var key = row[0];
            if (key === "RESULT TYPE") {
                headers = row.filter(not_empty_string).map(clean_csv_string);
                headers[0] = "Site";
            } else if (collectTag(key)) {
                info[key] = clean_csv_string(row[1]);
            } else if (key == "Site #") {
                var rowTags = sectionTags.map(function(d) { return info[d]; });
                var meas = this.readMeasurements(rowTags, headers);
                this.mergeMeasurements(info, meas, headers);
                return true;
            }
        }
        return false;
    },

    readAll: function(measInfo) {
        while (this.readSection(measInfo)) { }
    },

    next: function() { return this.reader.next(); }
};
