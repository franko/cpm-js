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

var arrayAreEqual = function(a, b) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return (b.length === a.length);
};

DataFrame.prototype.findCoupledLevels = function(names) {
    var js = names.map(function(name) { return this.colIndexOf(name); }, this);
    var levels = [];
    for (var i = 1; i <= this.rows(); i++) {
        var ys = js.map(function(j) { return this.e(i, j); }, this);
        if (!levels.some(function(zs) { return arrayAreEqual(ys, zs); })) {
            levels.push(ys);
        }
    }
    return levels;
};

DataFrame.prototype.setElements = function(data) {
    this.elements = data;
};

DataFrame.prototype.rowMatchFactors = function(i, values) {
    var match = 0;
    var kno = values.length;
    for (var k = 0; k < kno; k++) {
        var j = values[k].column, xval = values[k].value;
        if (this.e(i, j) === xval) {
            match += 1;
        }
    }
    return (match == kno);
};

DataFrame.prototype.filter = function(condition) {
    var data = [];
    for (var i = 1; i < this.rows(); i++) {
        if (this.rowMatchFactors(i, condition)) {
            data.push(this.elements[i-1]);
        }
    }
    return DataFrame.create(data, this.headers);
};

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

var evalExpected = function(factors, estimates, tab) {
    var Yd = [];
    for (var i = 1; i <= tab.rows(); i++) {
        Yd.push(evalRowExpected(factors, estimates, tab, i));
    }
    return Sylvester.Vector.create(Yd);
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
    return DataFrame.create(stat, statHeaders);
};

var plotByReprod = function(svg, data, yIndex) {
    var svgWidth = svg.attr("width"), svgHeight = svg.attr("height");
    var margin = {top: 20, right: 30, bottom: 30, left: 40};
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;
    var factors = ["Reprod", "Site"];
    var xLevels = data.findCoupledLevels(factors);
    var toCondition = function(y, i) {
        return {column: data.colIndexOf(factors[i]), value: y};
    };
    var xLevelConditions = xLevels.map(function(ys) { return ys.map(toCondition); });
    var values = data.elements.map(function(row, i) {
        for (var k = 0; k < xLevels.length; k++) {
            if (data.rowMatchFactors(i+1, xLevelConditions[k])) {
                return [k, row[yIndex - 1]];
            }
        }
    });
    var ySelector = function(d) { return d[yIndex - 1]; };
    var ymin = d3.min(data.elements, ySelector), ymax = d3.max(data.elements, ySelector);
    var yScale = d3.scale.linear().domain([ymin, ymax]).range([height, 0]).nice();
    var xScale = d3.scale.ordinal().domain(xLevels.map(function(d, i) { return i; })).rangeBands([0, width]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left");

    var chartTranslate = "translate(" + margin.left + "," + margin.top + ")";
    var chart = svg.append("g").attr("transform", chartTranslate);

    var palette = d3.scale.category10();

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    chart.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    var g = svg.append("g").attr("transform", chartTranslate);

    g.selectAll("circle").data(values)
        .enter().append("circle")
        .attr("cx", function(p) { return xScale(p[0]); })
        .attr("cy", function(p) { return yScale(p[1]); })
        .attr("r", 5).style("fill", function(p) { return palette(Math.floor(p[0]/17)); });
};

var plotLegend = function(svg, items) {
    var legend = svg.selectAll(".legend").data(items)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) { return "translate(0," + i * 24 + ")"; });

    legend.append("path").attr("d", "M 18,24 38,24")
        .attr("stroke", function(d) { return d.color; })
        .attr("stroke-width", 2)
        .attr("fill", "none");

    legend.append("text")
        .attr("x", 18 + 20 + 10)
        .attr("y", 18 + 6)
        .attr("dy", ".35em")
        .text(function(d) { return d.text; });
};

var gaussianDens = function(u, s, x) {
    return 1/(Math.sqrt(2*Math.PI) * s) * Math.exp(-Math.pow((x - u)/s, 2)/2);
}

var plotToolDistrib = function(svg, stat) {
    var svgWidth = svg.attr("width"), svgHeight = svg.attr("height");
    var margin = {top: 20, right: 30, bottom: 30, left: 40};
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;

    var meanIndex = stat.colIndexOf("Mean"), stdIndex = stat.colIndexOf("StdDev");
    var xmin = d3.min(stat.elements, function(row) { return row[meanIndex-1] - 6*row[stdIndex-1]; });
    var xmax = d3.max(stat.elements, function(row) { return row[meanIndex-1] + 6*row[stdIndex-1]; });
    var xScale = d3.scale.linear().domain([xmin, xmax]).range([0, width]);

    var ymax = d3.max(stat.elements, function(row) { return gaussianDens(0, row[stdIndex-1], 0); });
    var yScale = d3.scale.linear().domain([0, ymax]).range([height, 0]).nice();

    var sampledYs = stat.elements.map(function(row) {
        var ls = [];
        var u = row[meanIndex-1], s = row[stdIndex-1];
        var nSamples = 512;
        for (var i = 0; i <= nSamples; i++) {
            var x = xmin + (xmax - xmin) * i / nSamples;
            ls.push([x, gaussianDens(u, s, x)]);
        }
        return ls;
    });

    var lineFunction = d3.svg.line()
        .x(function (d) { return xScale(d[0]); })
        .y(function (d) { return yScale(d[1]); })
        .interpolate("linear");

    var palette = d3.scale.category10();

    var chartTranslate = "translate(" + margin.left + "," + margin.top + ")";
    var chart = svg.append("g").attr("transform", chartTranslate);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left");

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    chart.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    chart.selectAll(".avgline").data(stat.elements).enter()
        .append("path").attr("d", function(row, i) {
            var xAvg = row[meanIndex-1];
            var yMax = gaussianDens(0, row[stdIndex-1], 0);
            return "M" + xScale(xAvg) + "," + yScale(0) + " " + xScale(xAvg) + "," + yScale(yMax);
        }).attr("stroke", "#e12").attr("stroke-dasharray", "5,3");

    var g = svg.append("g").attr("transform", chartTranslate);

    g.selectAll("path").data(sampledYs)
        .enter().append("path")
        .attr("d", lineFunction)
        .attr("stroke", function(ys, i) { return palette(i); })
        .attr("stroke-width", 2)
        .attr("fill", "none");

    var gLegend = svg.append("g").attr("transform", chartTranslate);
    var toolIndex = stat.colIndexOf("Tool");
    plotLegend(gLegend, stat.elements.map(function(row, i) {
        return {color: palette(i), text: row[toolIndex-1]};
    }));
}

var erf = function(x) {
    // constants
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

var cpmStdDevEstimateBiasCorrect = function(stat, factors) {
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

var cpmComputeByTool = function(stat, deltaSpec) {
    var stdIndex = stat.colIndexOf("StdDev");
    var toolIndex = stat.colIndexOf("Tool");
    var cpmData = [];
    for (var i = 1; i <= stat.rows(); i++) {
        var cpm = deltaSpec / (6 * stat.e(i, stdIndex));
        cpmData.push([stat.e(i, toolIndex), stat.e(i, stdIndex), cpm]);
    }
    return DataFrame.create(cpmData, ["Tool", "StdDev", "CPM"]);
}

function computeCPM(data, measuredParameter, deltaSpec) {
    var measuredParamIndex = data.colIndexOf(measuredParameter);
    var siteIndex = data.colIndexOf("Site");
    var toolIndex = data.colIndexOf("Tool");

    var siteLevels = data.findLevels("Site");
    var toolLevels = data.findLevels("Tool");

    var measVector = data.col(measuredParamIndex);

    var cpm_factors = [
        [] // Represent the grand average.
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

    var stat = residualMeanSquares(data, tool_factors, cpm_factors, est, measVector);
    cpmStdDevEstimateBiasCorrect(stat, cpm_factors);
    var cpmTable = cpmComputeByTool(stat, deltaSpec);
    console.log(stat.inspect());

    dataTool0 = data.filter(tool_factors[0]);
    plotByReprod(d3.select("#toolrep"), dataTool0, measuredParamIndex);

    plotToolDistrib(d3.select("#gaussplot"), stat);

    var xL0 = d3.min(stat.elements, function(row) { return row[stat.colIndexOf("Mean")-1] - 3*row[stat.colIndexOf("StdDev")-1]; });
    var xR0 = d3.max(stat.elements, function(row) { return row[stat.colIndexOf("Mean")-1] + 3*row[stat.colIndexOf("StdDev")-1]; });
    var xL = mixtureGaussianQuantiles(stat, 0.0013498980316301, xL0);
    var xR = mixtureGaussianQuantiles(stat, 1 - 0.0013498980316301, xR0);

    var sigmaProcess = computeSigmaProcess(data, cpm_factors, est);

    var resultDiv = d3.select("#cpmresult");
    resultDiv.append("h1").html("Results");
    resultDiv.append("p").html("\u03C3" + "<sub>process</sub> : " + sigmaProcess.toPrecision(5));
    renderTable(resultDiv.append("p"), cpmTable);
    resultDiv.append("p").html("CPM<sub>toolset</sub> : " + (deltaSpec / (xR - xL)).toPrecision(5));
};
