
var loadFiles


/* ********************** File List / Read Files ****************** */

/* Given a "file" return a list with [filename, toolname, reprod].
   As for the "file" argument it is just required to have a "name" field.
   The toolname and reprod is guessed from the filename. */
var filenameToolFields = function(file, i) {
    var nameRe = /(Q[A-Z0-9]+).*SERIE([0-9]+)/i;
    var filename = file.name;
    var match = nameRe.exec(filename);
    if (match) {
        return [filename, match[1], match[2]];
    } else {
        return [filename, "Tool " + String.fromCharCode(65 + i), "1"];
    }
};

var fileListRowId = function(i) { return "fileListRow" + String(i); }

/* Create a Table with the filename, tool name and reprod number.
   Identifies each row with the Id given by fileListRowId. */
var createFileListTable = function(containerId, files) {
    var table = d3.select(containerId).append("table")
    var thead = table.append("thead");
    var tbody = table.append("tbody").attr("id", "filetable");

    thead.append("tr")
        .selectAll("th")
        .data(["Filename", "Tool", "Reprod"])
        .enter()
        .append("th")
            .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(files)
        .enter()
        .append("tr").attr("id", function(d, i) { return fileListRowId(i); });

    // create a cell in each row for each column
    var cells = rows.selectAll("td")
        .data(filenameToolFields)
        .enter().append("td")
        .html(function(d, i) {
            if (i == 1 || i == 2) {
                return "<input type=\"text\" value=" + JSON.stringify(d) + ">";
            } else {
                return d;
            }
        });
}

/* Collect all the file's data from the "File List" table and
   pass the array to the "loadFiles" function. */
var onButtonReadFiles = function(files) {
    var annFiles = [];
    for (var k = 0; k < files.length; k++) {
        var tr = document.getElementById(fileListRowId(k));
        var tool = tr.childNodes[1].firstChild.value;
        var reprod = Number(tr.childNodes[2].firstChild.value);
        annFiles.push({handler: files[k], tool: tool, reprod: reprod});
    }
    loadFiles(annFiles);
}

function onFileSelection(evt) {
    var files = evt.target.files;
    var containerId = "#file_select";
    createFileListTable(containerId, files);
    var button = d3.select(containerId).append("button").text("Read Files");
    button.on("click", function() { return onButtonReadFiles(files); });
}




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

    var K = LinEst.buildFactorMatrix(data, cpm_factors);
    var S = LinEst.buildFactorSumVector(data, cpm_factors, measVector);
    var est = K.inverse().multiply(S); // Estimates.

    var stat = Cpm.residualMeanSquares(data, tool_factors, cpm_factors, est, measVector);
    var cpmTable = Cpm.computeByTool(stat, deltaSpec);

    dataTool0 = data.filter(tool_factors[0]);
    plotByReprod(d3.select("#toolrep"), dataTool0, measuredParamIndex);

    plotToolDistrib(d3.select("#gaussplot"), stat);

    var xL0 = d3.min(stat.elements, function(row) { return row[stat.colIndexOf("Mean")-1] - 3*row[stat.colIndexOf("StdDev")-1]; });
    var xR0 = d3.max(stat.elements, function(row) { return row[stat.colIndexOf("Mean")-1] + 3*row[stat.colIndexOf("StdDev")-1]; });
    var xL = Cpm.mixtureGaussianQuantiles(stat, 0.0013498980316301, xL0);
    var xR = Cpm.mixtureGaussianQuantiles(stat, 1 - 0.0013498980316301, xR0);

    var sigmaProcess = Cpm.computeSigmaProcess(data, cpm_factors, est);

    var resultDiv = d3.select("#cpmresult");
    resultDiv.append("h1").html("Results");
    resultDiv.append("p").html("\u03C3" + "<sub>process</sub> : " + sigmaProcess.toPrecision(5));
    renderTable(resultDiv.append("p"), cpmTable);
    resultDiv.append("p").html("CPM<sub>toolset</sub> : " + (deltaSpec / (xR - xL)).toPrecision(5));
};

var tablesExtractOnParameters = function(measSections, parameterIndex, paramName, deltaSpec, useDateTime) {
    var iTable = parameterIndex[0], iCol = parameterIndex[1];
    var section = measSections[iTable];
    var table = section.table;
    var data = [];
    var n = table.rows();
    var fields = ["Tool", "Wafer", "Reprod", "Site", "Repeat"];
    if (useDateTime) {
        fields.splice(1, 0, "Time");
    }
    fields.push(section.resultHeaders[iCol]);
    var colIndex = fields.map(function(d) { return table.colIndexOf(d); });
    for (var i = 1; i <= n; i++) {
        var row = [];
        for (var k = 0; k < colIndex.length; k++) {
            row[k] = table.e(i, colIndex[k]);
        }
        data.push(row);
    }
    // Rename measured parameter with user's supplied name.
    fields[fields.length - 1] = paramName;
    var cpmData = DataFrame.create(data, fields);
    renderTable(d3.select("#container"), cpmData);
    computeCPM(cpmData, paramName, deltaSpec);
};

var onParameterChoice = function(measSections, selParams, useDateTime) {
    var index = 0;
    var paramName = d3.select("#paramnameinput" + (index+1)).property("value");
    var deltaSpec = +d3.select("#deltaspecinput" + (index+1)).property("value");
    tablesExtractOnParameters(measSections, selParams[index], paramName, deltaSpec, useDateTime);
};

function renderTable(element, data) {
    var table = element.append("table").attr("class", "result");
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    thead.append("tr")
        .selectAll("th").data(data.headers)
        .enter().append("th").text(function(d) { return d; });

    var rows = tbody.selectAll("tr").data(data.elements)
        .enter().append("tr");

    var cells = rows.selectAll("td").data(function(d) { return d; })
        .enter().append("td")
        .text(function(d) { return d; });
}

var renderParameters = function(measSections, onChoice) {
    var div = d3.select("#parameters");

    var dtpar = div.append("p")
    dtpar.html("Include Date/Time")
    var checktime = dtpar.append("input").attr("type", "checkbox").attr("value", "datetime");

    var sel = div.append("select");
    var optGroups = sel.selectAll("optgroup").data(measSections)
        .enter().append("optgroup")
        .attr("label", function(d) { return d.info["MEAS SET"]; });

    optGroups.selectAll("option").data(function(section) { return section.resultHeaders; })
        .enter().append("option").text(function(d) { return d; });

    var t = div.append("table");
    var thead = t.append("thead");
    var tbody = t.append("tbody");

    var thRow = thead.append("tr");
    thRow.append("th").text("Measurement Set");
    thRow.append("th").text("Tool Name");
    thRow.append("th").text("Parameter Name");
    thRow.append("th").text("Delta Spec");

    var selParams = [];

    var findIndexes = function(ls, pair) {
        for (var i in ls) {
            var x = ls[i];
            if (x[0] === pair[0] && x[1] === pair[1]) {
                return i;
            }
        }
        return -1;
    }

    var button = div.append("button").text("Add Parameter")
        .on("click", function() {
            var index = sel.property("selectedIndex");
            if (index < 0) return;
            var offset = 0;
            var i = 0, j;
            while (i < measSections.length) {
                var t = measSections[i];
                if (index < offset + t.resultHeaders.length) {
                    j = (index - offset);
                    break;
                }
                offset += t.resultHeaders.length;
                i++;
            }
            var selSection = measSections[i];
            var iPair = [i, j];
            var iFound = findIndexes(selParams, iPair);
            if (iFound < 0) {
                selParams.push(iPair);
                var tr = tbody.append("tr");
                tr.append("td").text(selSection.info["MEAS SET"]);
                tr.append("td").text(selSection.resultHeaders[j]);
                tr.append("td").append("input").attr("type", "text").attr("value", "THICKNESS_" + String(selParams.length)).attr("id", "paramnameinput" + selParams.length);
                tr.append("td").append("input").attr("type", "number").attr("id", "deltaspecinput" + selParams.length);
            }
        });

    var nsButton = div.append("button").text("Next")
        .on("click", function() { onChoice(measSections, selParams, checktime.property("checked")); });
}

var adjustSectionsDateTime = function(measSections, datetime_min) {
    for (var k = 0; k < measSections.length; k++) {
        var section = measSections[k];
        var table = section.table;
        var timeIndex = table.colIndexOf("Time") - 1;
        for (var i = 0; i < table.rows(); i++) {
            table.elements[i][timeIndex] = table.elements[i][timeIndex] - datetime_min;
        }
    }
}

function loadFiles(files) {
    var measSections = [];
    var count = 0;
    var datetime_min = null;
    for (var i = 0; i < files.length; i++) {
        var onLoadFileIndexed = function(index) {
            return function(evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    var parser = new FXParser(evt.target.result, {groupRepeat: 5, sections: measSections});
                    var dt = parser.readDateTime();
                    datetime_min = (datetime_min === null || dt < datetime_min) ? dt : datetime_min;
                    parser.readAll({tool: files[index].tool, reprod: files[index].reprod, time: dt});
                    count++;
                    if (count >= files.length) {
                        adjustSectionsDateTime(measSections, datetime_min);
                        renderParameters(measSections, onParameterChoice);
                    }
                }
            };
        };
        var reader = new FileReader();
        reader.onloadend = onLoadFileIndexed(i);
        reader.readAsText(files[i].handler);
    }
};
