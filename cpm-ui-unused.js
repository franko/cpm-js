
function renderMeasTable(measTable) {
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
}

function renderParameters(tables, onChoice) {
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

var onParameterChoice = function(tables, params) {
    for (var k = 0; k < params.length; k++) {
        var iTable = params[k][0], iCol = params[k][1];
        var table = tables[iTable];
        var data = [];
        var n = table.meas.length;
        var colIndex = ["Tool", "Wafer", "Site", "Reprod", "Repeat"].map(function(d) { return table.headers.indexOf(d); });
        colIndex.push(iCol);
        for (var i = 0; i < n; i++) {
            for (var k = 0; k < colIndex.length; k++) {
                data.push(table.meas[i][colIndex[k]]);
            }
        }
        var df = DataFrame.create(n, colIndex.length, data);
    }
};
