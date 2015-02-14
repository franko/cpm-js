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

DataFrame.create = function(data, headers) {
    var obj = new DataFrame();
    obj.setElements(data);
    obj.headers = headers.slice();
    return obj;
};

DataFrame.prototype = new Sylvester.Matrix;

DataFrame.prototype.colIndexOf = function(name) {
    return this.headers.indexOf(name) + 1;
};

DataFrame.prototype.findLevels = function(name) {
    var j = this.colIndexOf(name);
    var levels = [];
    for (var i = 1; i <= this.rows(); i++) {
        var y = this.e(i, j);
        if (levels.indexOf(y) < 0) {
            levels.push(y);
        }
    }
    return levels;
};

DataFrame.prototype.setElements = function(data) {
    this.elements = data;
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
    for (var i = 1; i <= t.rows(); i++) {
        var yi = y ? y.e(i) : 1;
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
    for (var i = 1; i <= tab.rows(); i++) {
        Yd.push(evalRowExpected(factors, estimates, tab, i));
    }
    return Sylvester.Vector.create(Yd);
};

var residualMeanSquares = function(tab, groups, factors, estimates, y, ncomputed) {
    var stat = [];
    for (var p = 0; p < groups.length; p++) {
        var condition = groups[p];
        var row = [];
        for (var k = 0; k < condition.length; k++) {
            row[k] = condition[k].value;
        }
        var sumsq = 0, n = 0;
        for (var i = 1; i <= tab.rows(); i++) {
            if (matchFactors(tab, i, condition)) {
                var yEst = evalRowExpected(factors, estimates, tab, i);
                sumsq += Math.pow(yEst - y.e(i), 2);
                n += 1;
            }
        }
        row.push(Math.sqrt(sumsq / (n - ncomputed)));
        stat.push(row);
    }
    var statHeaders = groups[0].map(function(d) { return d.value; });
    statHeaders.push("Variance");
    return DataFrame.create(stat, statHeaders);
};

function computeCPM(data, measuredParameter) {
    var measuredParamIndex = data.colIndexOf(measuredParameter);
    var siteIndex = data.colIndexOf("Site");
    var toolIndex = data.colIndexOf("Tool");

    var siteLevels = data.findLevels("Site");
    var toolLevels = data.findLevels("Tool");

    var measVector = data.col(measuredParamIndex);

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
    console.log(stat.inspect());
};
