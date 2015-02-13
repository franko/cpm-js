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

DataFrame.create = function(nrows, headers, data) {
    var T = new DataFrame();
    T.setDimensions(nrows, headers);
    T.setData(data);
    return T;
};

DataFrame.prototype = {
    setDimensions: function(nrows, headers) {
        this.headers = headers;
        this.nrows = nrows;
        this.ncols = headers.length;
    },

    findLevels: function(name) {
        var j = this.headers.indexOf(name);
        var levels = [];
        for (var i = 0; i < this.nrows; i++) {
            var y = this.data[i*this.ncols + j];
            if (levels.indexOf(y) < 0) {
                levels.push(y);
            }
        }
        return levels;
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
        stat.push(Math.sqrt(sumsq / (n - ncomputed)));
    }
    var statHeaders = groups[0].map(function(d) { return d.value; });
    statHeaders.push("Variance");
    return DataFrame.create(groups.length, statHeaders, stat);
};

function computeCPM(data, measuredParameter) {
    var measuredParamIndex = data.headers.indexOf(measuredParameter) + 1;
    var siteIndex = data.headers.indexOf("Site") + 1;
    var toolIndex = data.headers.indexOf("Tool") + 1;

    var siteLevels = data.findLevels("Site");
    var toolLevels = data.findLevels("Tool");

    var measVector = DataFrameView.create(data, 1, measuredParamIndex, data.nrows, 1);

    var cpm_factors = [
        []
    ];

    // Add a factor for each level of Site effect. First site is skipped.
    for (var k = 1, level; level = siteLevels[k]; k++) {
        cpm_factors.push([{column: siteIndex, value: level}]);
    }

    // Add a factor for each level of Tool effect. First tool is skipped.
    for (var k = 1, level; level = toolLevels[k]; k++) {
        cpm_factors.push([{column: toolIndex, value: level}]);
    }

    var tool_factors = [];
    for (var k = 0, level; level = toolLevels[k]; k++) {
        tool_factors.push([{column: toolIndex, value: level}]);
    }

    var K = buildFactorMatrix(data, cpm_factors);
    var S = buildFactorSumVector(data, cpm_factors, measVector);
    var est = K.inverse().multiply(S); // Estimates.
    var Yest = evalExpected(cpm_factors, est, data);

    console.log(est.inspect());

    var nComputeAverages = siteLevels.length;
    var stat = residualMeanSquares(data, tool_factors, cpm_factors, est, measVector, nComputeAverages);
    for (var i = 1; i <= stat.nrows; i++) {
        console.log(stat.e(i, 1), stat.e(i, 2))
    }
};
