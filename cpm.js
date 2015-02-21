
var sumOccurrences = function(t, values, y) {
    var sum = 0;
    for (var i = 1; i <= t.rows(); i++) {
        var yi = y ? y.e(i) : 1;
        sum += t.rowMatchFactors(i, values) ? yi : 0;
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
        var match = tab.rowMatchFactors(i, factors[p]);
        sum += match ? estimates.e(p+1) : 0;
    }
    return sum;
};

LinEst = {
    sumOccurrences: sumOccurrences,
    buildFactorMatrix: buildFactorMatrix,
    buildFactorSumVector: buildFactorSumVector,
    evalRowExpected: evalRowExpected,
};

var stdDevEstimateBiasCorrect = function(stat, factors) {
    var degOfFreedom = factors.length;
    var stdIndex = stat.colIndexOf("StdDev"), countIndex = stat.colIndexOf("Count");
    var nSum = 0;
    for (var i = 1; i <= stat.rows(); i++) {
        nSum += stat.e(i, countIndex);
    }
    for (var i = 1; i <= stat.rows(); i++) {
        var sigma = stat.e(i, stdIndex), n = stat.e(i, countIndex);
        stat.elements[i-1][stdIndex-1] = stat.elements[i-1][stdIndex-1] * Math.sqrt(nSum / (nSum - degOfFreedom));
    }
};

var residualMeanSquares = function(tab, groups, factors, estimates, y) {
    var stat = [];
    for (var p = 0; p < groups.length; p++) {
        var condition = groups[p];
        var row = [];
        for (var k = 0; k < condition.length; k++) {
            row[k] = condition[k].value;
        }
        var sumsq = 0, n = 0;
        var sum = 0;
        for (var i = 1; i <= tab.rows(); i++) {
            if (tab.rowMatchFactors(i, condition)) {
                var yEst = evalRowExpected(factors, estimates, tab, i);
                sum += y.e(i);
                sumsq += Math.pow(yEst - y.e(i), 2);
                n += 1;
            }
        }
        row.push(sum / n);
        row.push(Math.sqrt(sumsq / n));
        row.push(n);
        stat.push(row);
    }
    var statHeaders = groups[0].map(function(d) { return tab.headers[d.column - 1]; });
    statHeaders.push("Mean");
    statHeaders.push("StdDev");
    statHeaders.push("Count");
    var stat = DataFrame.create(stat, statHeaders);
    stdDevEstimateBiasCorrect(stat, factors);
    return stat;
};

var erf = function(x) {
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    // Save the sign of x
    var sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

    return sign*y;
};

/* Find the x that statisfies 'Integral_{-Inf}{x} f(x) dx = P' where f(x) is
   a mixture density probability distributions of N normal distributions given
   by stat and P is a given probability, the 'prob' argument.
   Use the newton method to find the solution of the equation. x0 should be
   "close enough" to the solution to ensure that the algorithm converges. */
var mixtureGaussianQuantiles = function(stat, prob, x0) {
    var meanIndex = stat.colIndexOf("Mean"), stdIndex = stat.colIndexOf("StdDev");
    var n = stat.rows();
    var us = stat.elements.map(function(row) { return row[meanIndex-1]; });
    var ss = stat.elements.map(function(row) { return row[stdIndex-1]; });

    var avg = 0;
    for (var i = 0; i < n; i++) {
        avg += us[i];
    }
    avg = avg / n;
    var sqrt2 = Math.sqrt(2);

    var f = function(x) {
        var p = 0;
        for (var i = 0; i < n; i++) {
            p += 0.5 * (1 + erf((x-us[i])/(ss[i]*sqrt2)));
        }
        return p / n - prob;
    };
    var derf = function(x) {
        var p = 0;
        for (var i = 0; i < n; i++) {
            p += gaussianDens(us[i], ss[i], x);
        }
        return p / n;
    };
    var x = x0;
    for (var i = 0; i < 20; i++) {
        var xp = x;
        var x = xp - f(xp) / derf(xp);
        if (Math.abs(x-xp) < Math.abs(avg) * 1e-5) {
            break;
        }
    }
    return x;
};

var computeSigmaProcess = function(data, factors, estimates) {
    var siteIndex = data.colIndexOf("Site");
    var s = 0, n = 0, ssq = 0;
    /* Count the linear estimate terms that corresponds to a simple
       site effect. */
    for (var i = 1; i <= estimates.dimensions(); i++) {
        var f = factors[i-1];
        if (f.length == 1 && f[0].column == siteIndex) {
            var x = estimates.e(i);
            s += x;
            ssq += x*x;
            n++;
        }
    }
    // The average is divided by (n+1) because the first site is implicitly zero.
    // The overall difference is divided by n to obtain the *unbiased* estimation
    // of the standard deviation.
    return Math.sqrt(ssq/n - s*s/((n+1)*n));
}

var computeByTool = function(stat, deltaSpec) {
    var stdIndex = stat.colIndexOf("StdDev");
    var toolIndex = stat.colIndexOf("Tool");
    var cpmData = [];
    for (var i = 1; i <= stat.rows(); i++) {
        var cpm = deltaSpec / (6 * stat.e(i, stdIndex));
        cpmData.push([stat.e(i, toolIndex), stat.e(i, stdIndex), cpm]);
    }
    return DataFrame.create(cpmData, ["Tool", "StdDev", "CPM"]);
}

Cpm = {
    residualMeanSquares: residualMeanSquares,
    mixtureGaussianQuantiles: mixtureGaussianQuantiles,
    computeSigmaProcess: computeSigmaProcess,
    computeByTool: computeByTool,
};
