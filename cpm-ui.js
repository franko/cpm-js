
var tablesExtractOnParameters = function(tables, parameterIndex) {
    var iTable = parameterIndex[0], iCol = parameterIndex[1];
    var table = tables[iTable];
    var data = [];
    var n = table.meas.length;
    var fields = ["Tool", "Wafer", "Reprod", "Site", "Repeat"];
    fields.push(table.resultHeaders[iCol]);
    var colIndex = fields.map(function(d) { return table.headers.indexOf(d); });
    for (var i = 0; i < n; i++) {
        for (var k = 0; k < colIndex.length; k++) {
            data.push(table.meas[i][colIndex[k]]);
        }
    }
    var cpmData = DataFrame.create(n, fields, data);
    computeCPM(cpmData, table.resultHeaders[iCol]);
};

var renderMeasTable = function(measTable) {
    var table = d3.select("#container").append("table")
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    table.classed("measure", true);

    thead.append("tr")
        .selectAll("th")
        .data(measTable.headers)
        .enter()
        .append("th")
            .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(measTable.meas)
        .enter()
        .append("tr");

    // create a cell in each row for each column
    var cells = rows.selectAll("td")
        .data(function(row) { return row; })
        .enter()
        .append("td")
            .text(function(d) { return d; });
};

var onParameterChoice = function(tables, selParams) {
    for (var i = 0, t; t = tables[i]; i++) {
        renderMeasTable(t);
    }
    var df = tablesExtractOnParameters(tables, selParams[0]);
    console.log(df);
};

var renderParameters = function(tables, onChoice) {
    var div = d3.select("#parameters");
    var sel = div.append("select");
    var optGroups = sel.selectAll("optgroup").data(tables)
        .enter().append("optgroup")
        .attr("label", function(d) { return d.info["MEAS SET"]; });

    optGroups.selectAll("option").data(function(table) { return table.resultHeaders; })
        .enter().append("option").text(function(d) { return d; });

    var t = div.append("table");
    var thead = t.append("thead");
    var tbody = t.append("tbody");

    var thRow = thead.append("tr");
    thRow.append("th").text("Measurement Set");
    thRow.append("th").text("Tool Name");
    thRow.append("th").text("Parameter Name");

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
            while (i < tables.length) {
                var t = tables[i];
                if (index < offset + t.resultHeaders.length) {
                    j = (index - offset);
                    break;
                }
                offset += t.resultHeaders.length;
                i++;
            }
            var selTable = tables[i];
            var iPair = [i, j];
            var iFound = findIndexes(selParams, iPair);
            if (iFound < 0) {
                selParams.push(iPair);
                var tr = tbody.append("tr");
                tr.append("td").text(selTable.info["MEAS SET"]);
                tr.append("td").text(selTable.resultHeaders[j]);
                tr.append("td").append("input").attr("type", "text").attr("value", "TH_SOMETHING_" + String(selParams.length));
            }
        });

    var nsButton = div.append("button").text("Next")
        .on("click", function() { onChoice(tables, selParams); });
}

var mergeTables = function(tables, src) {
    for (var i = 0; i < src.length; i++) {
        var j;
        for (j = 0; j < tables.length; j++) {
            if (FXParser.tablesDoMatch(tables[j], src[i])) {
                var data = tables[j].meas;
                for (var k = 0; k < src[i].meas.length; k++) {
                    data.push(src[i].meas[k]);
                }
                break;
            }
        }
        if (j >= tables.length) {
            tables.push(src[i]);
        }
    }
};

var onFileComplete = function(files) {
    var tables = [];
    var count = 0;
    for (var i = 0; i < files.length; i++) {
        var onLoadFileIndexed = function(index) {
            return function(evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    var parser = new FXParser(evt.target.result, {groupRepeat: 5});
                    var dt = parser.readDateTime();
                    parser.readAll({tool: files[index].tool, reprod: files[index].reprod});
                    mergeTables(tables, parser.tables);
                    count++;
                    if (count >= files.length) {
                        renderParameters(tables, onParameterChoice);
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
