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

DataFrame.prototype.filter = function(condition) {
    var data = [];
    for (var i = 1; i < this.rows(); i++) {
        if (matchFactors(this, i, condition)) {
            data.push(this.elements[i-1]);
        }
    }
    return DataFrame.create(data, this.headers);
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
            if (matchFactors(tab, i, condition)) {
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
            if (matchFactors(data, i+1, xLevelConditions[k])) {
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
        var nSamples = 32;
        for (var i = 0; i <= nSamples; i++) {
            var x = xmin + (xmax - xmin) * i / nSamples;
            ls.push([x, gaussianDens(u, s, x)]);
        }
        return ls;
    });

    var lineFunction = d3.svg.line()
        .x(function (d) { return xScale(d[0]); })
        .y(function (d) { return yScale(d[1]); })
        .interpolate("basis");

    var palette = d3.scale.category10();

    var chart = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

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

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    g.selectAll("path").data(sampledYs)
        .enter().append("path")
        .attr("d", lineFunction)
        .attr("stroke", function(ys, i) { return palette(i); })
        .attr("stroke-width", 2)
        .attr("fill", "none");
}

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

function computeCPM(data, measuredParameter) {
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
    console.log(stat.inspect());

    dataTool0 = data.filter(tool_factors[0]);
    plotByReprod(d3.select("#toolrep"), dataTool0, measuredParamIndex);

    plotToolDistrib(d3.select("#gaussplot"), stat);
};
