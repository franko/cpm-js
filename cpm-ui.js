
var tablesExtractOnParameters = function(measSections, parameterIndex, paramName, deltaSpec) {
    var iTable = parameterIndex[0], iCol = parameterIndex[1];
    var section = measSections[iTable];
    var table = section.table;
    var data = [];
    var n = table.rows();
    var fields = ["Tool", "Wafer", "Reprod", "Site", "Repeat"];
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

var onParameterChoice = function(measSections, selParams) {
    var index = 0;
    var paramName = d3.select("#paramnameinput" + (index+1)).property("value");
    var deltaSpec = +d3.select("#deltaspecinput" + (index+1)).property("value");
    tablesExtractOnParameters(measSections, selParams[index], paramName, deltaSpec);
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
        .on("click", function() { onChoice(measSections, selParams); });
}

var onFileComplete = function(files) {
    var measSections = [];
    var count = 0;
    for (var i = 0; i < files.length; i++) {
        var onLoadFileIndexed = function(index) {
            return function(evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    var parser = new FXParser(evt.target.result, {groupRepeat: 5, sections: measSections});
                    var dt = parser.readDateTime();
                    parser.readAll({tool: files[index].tool, reprod: files[index].reprod});
                    count++;
                    if (count >= files.length) {
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

var filenameToolFields = function(file, i) {
    var nameRe = /(Q[A-Z0-9]+).*SERIE([0-9]+)/i;
    var name = file.name;
    var match = nameRe.exec(name);
    if (match) {
        return [name, match[1], match[2]];
    } else {
        return [name, "Tool " + String.fromCharCode(65 + i), "1"];
    }
};

var renderFileListTable = function(files, onComplete) {
    var table = d3.select("#file_select").append("table")
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
        .append("tr").attr("id", function(d, i) { return "row" + String(i); });

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

    var button = d3.select("#file_select").append("button").text("Read Files");
    button.on("click", function() {
        var annFiles = [];
        for (var k = 0; k < files.length; k++) {
            var tr = document.getElementById("row" + String(k));
            var tool = tr.childNodes[1].firstChild.value;
            var reprod = Number(tr.childNodes[2].firstChild.value);
            annFiles.push({handler: files[k], tool: tool, reprod: reprod});
        }
        onComplete(annFiles);
    });
};

function onFileSelection(evt) {
    var files = evt.target.files;
    renderFileListTable(files, onFileComplete);
}
