/* TODO list:
   IMPORTANT THINGS:
   - introduce coherent naming convetions for factors & co to clarify usage
   - comments each functions
   - put linear estimate functions in a specific namespace

   MINOR:
   - when factors specification are incompatibles (e.g. column 5 should be X and
     column 5 should be Y (!= X)) return immediatly zero in sumOccurrencies.
*/

DataFrame = function() { };

DataFrame.create = function(nrows, ncols, data) {
    var T = new DataFrame();
    T.setDimensions(nrows, ncols);
    T.setData(data);
    return T;
};

DataFrame.prototype = {
    setDimensions: function(nrows, ncols) {
        this.nrows = nrows;
        this.ncols = ncols;
    },

    setData: function(data) {
        this.data = data;
    },

    indexOf: function(i, j) {
        return (i-1)*this.ncols + (j-1);
    },

    e: function(i, j) {
        return this.data[(i-1)*this.ncols + (j-1)];
    }
};

DataFrameView = function() { };

DataFrameView.create = function(Tsrc, i0, j0, nrows, ncols) {
    var T = new DataFrameView();
    T.setView(Tsrc, i0, j0, nrows, ncols);
    return T;
};

DataFrameView.prototype = {
    setView: function(Tsrc, i0, j0, nrows, ncols) {
        this.data = Tsrc.data;
        this.start = Tsrc.indexOf(i0, j0);
        this.stride = Tsrc.ncols;
        this.nrows = nrows;
        this.ncols = ncols;
    },

    e: function(i, j) {
        return this.data[this.start + (i-1)*this.stride + (j-1)];
    }
};

var matchFactors = function(t, i, values) {
    var match = 0;
    var kno = values.length;
    for (var k = 0; k < kno; k++) {
        var j = values[k].column, xval = values[k].value;
        if (t.e(i, j) === xval) {
            match += 1;
        }
    }
    return (match == kno);
};

var sumOccurrences = function(t, values, y) {
    var sum = 0;
    for (var i = 1; i <= t.nrows; i++) {
        var yi = y ? y.e(i, 1) : 1;
        sum += matchFactors(t, i, values) ? yi : 0;
    }
    return sum;
};

var sige = DataFrame.create(1020, 9, cpm_sige_data)

var buildFactorMatrix = function(tab, factors) {
    var Kd = [];
    for (var p = 0; p < factors.length; p++) {
        var Krow = [];
        for (var q = 0; q < factors.length; q++) {
            var s = 0;
            if (p === q) {
                s = sumOccurrences(tab, factors[p]);
            } else {
                var cf = [].concat(factors[p]).concat(factors[q]);
                s = sumOccurrences(tab, cf);
            }
            Krow.push(s);
        }
        Kd.push(Krow);
    }
    return Sylvester.Matrix.create(Kd);
};

var buildFactorSumVector = function(tab, factors, y) {
    var Kd = [];
    for (var p = 0; p < factors.length; p++) {
        var s = sumOccurrences(tab, factors[p], y)
        Kd.push(s);
    }
    return Sylvester.Vector.create(Kd);
};

var evalRowExpected = function(factors, estimates, tab, i) {
    var sum = 0;
    for (var p = 0; p < factors.length; p++) {
        var match = matchFactors(tab, i, factors[p]);
        sum += match ? estimates.e(p+1) : 0;
    }
    return sum;
};

var evalExpected = function(factors, estimates, tab) {
    var Yd = [];
    for (var i = 1; i <= tab.nrows; i++) {
        Yd.push(evalRowExpected(factors, estimates, tab, i));
    }
    return Sylvester.Vector.create(Yd);
};

var residualMeanSquares = function(tab, groups, factors, estimates, y, ncomputed) {
    var stat = [];
    for (var p = 0; p < groups.length; p++) {
        var condition = groups[p];
        for (var k = 0; k < condition.length; k++) {
            stat.push(condition[k].value);
        }
        var sumsq = 0, n = 0;
        for (var i = 1; i <= tab.nrows; i++) {
            if (matchFactors(tab, i, condition)) {
                var yEst = evalRowExpected(factors, estimates, tab, i);
                var yObs = y.e(i, 1);
                sumsq += Math.pow(yEst - yObs, 2);
                n += 1;
            }
        }
        stat.push(sumsq / (n - ncomputed));
    }
    return DataFrame.create(groups.length, condition.length + 1, stat);
};

var cpm_test = function() {
    var sige_th = DataFrameView.create(sige, 1, 8, sige.nrows, 1);
    for (var i = 1; i <= 10; i++) {
        console.log("sige_th:", sige_th.e(i, 1));
    }

    var cpm_factors = [
        []
    ];

    for (var site = 2; site <= 17; site++) {
        cpm_factors.push([{column: 5, value: site}]);
    }

    var tools = ['QFX1001', 'QFX1002', 'QFX1003', 'QFX1006']
    for (var k = 1; k < tools.length; k++) {
        cpm_factors.push([{column: 4, value: tools[k]}]);
    }

    var tool_factors = [];
    for (var k = 0; k < tools.length; k++) {
        tool_factors.push([{column: 4, value: tools[k]}]);
    }

    var K = buildFactorMatrix(sige, cpm_factors);
    var S = buildFactorSumVector(sige, cpm_factors, sige_th);
    var est = K.inverse().multiply(S); // Estimates.
    var Yest = evalExpected(cpm_factors, est, sige);

    console.log(est.inspect());

    var stat = residualMeanSquares(sige, tool_factors, cpm_factors, est, sige_th, 17);
    for (var i = 1; i <= stat.nrows; i++) {
        console.log(stat.e(i, 1), stat.e(i, 2))
    }
};

var list_tonumber = function(row) {
    for (var i = 0; i < row.length; i++) {
        var x = Number(row[i]);
        if (!isNaN(x) && row[i] != "") {
            row[i] = x;
        }
    }
};

function csvReader(text) {
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
}
var baseTagList = ['RECIPE', 'MEAS SET', 'LOT ID', 'SLOT', 'WAFER ID', 'SITE', 'RCP CNT'];
var tabTagList = ['LOT ID', 'SLOT'];
var extTagList = ['SITE', 'RCP CNT']

FXParser = function(text, extended) {
    this.reader = csvReader(text);
    this.headers = {};
    this.sections = [];
    this.tagList = baseTagList;
    this.tabTagList = (extended ? tabTagList.concat(extTagList) : tabTagList);
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

    readMeasurements: function(slot) {
        var meas = [];
        for (var row = this.next(); row; row = this.next()) {
            if (!row[0]) break;
            meas.push(row.slice(0, -3));
        }
        return meas;
    },

    readSection: function() {
        var info = {};
        for (var row = this.next(); row; row = this.next()) {
            var key = row[0];
            if (key === "RESULT TYPE") {
                var mHeaders = row.slice(0, -1);
                mHeaders[0] = "Site #";
                var film_stack = info["MEAS SET"];
                this.headers[film_stack] = mHeaders;
            } else if (this.tagList.indexOf(key) >= 0) {
                info[key] = row[1];
            } else if (key == "Site #") {
                var meas = this.readMeasurements(info['SLOT']);
                return {info: info, measurements: meas};
            }
        }
    },

    readAll: function() {
        while (true) {
            var section = this.readSection();
            if (!section) break;
            this.sections.push(section);
        }
    },

    getHeaders: function(measSet) {
        return this.headers[measSet];
    },

    createMeasTable: function(measSet) {
        var fullHeaders = this.tabTagList.slice();
        var mHeaders = this.headers[measSet];
        for (var i = 0; i < mHeaders.length; i++) {
            fullHeaders.push(mHeaders[i]);
        }
        var data = [];
        for (var i in this.sections) {
            var section = this.sections[i];
            var info = section.info, meas = section.measurements;
            if (info["MEAS SET"] == measSet) {
                var info_array = this.tabTagList.map(function(h) { return info[h]; });
                for (var i = 0; i < meas.length; i++) {
                    data.push(info_array.concat(meas[i]));
                }
            }
        }
        return {headers: fullHeaders, data: data};
    },

    next: function() { return this.reader.next(); }
};

function renderMeasTable(measTable) {
    var table = d3.select("#container").append("table")
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    table.classed("measure", true);

    var columns = measTable.headers;

    thead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
            .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(measTable.data)
        .enter()
        .append("tr");

    var getNamedRow = function(row) {
        var ls = [];
        for (var i = 0; i < columns.length; i++) {
            ls.push({column: columns[i], value: row[i]});
        }
        return ls;
    }

    // create a cell in each row for each column
    var cells = rows.selectAll("td")
        .data(getNamedRow)
        .enter()
        .append("td")
            .text(function(d) { return d.value; });
}
