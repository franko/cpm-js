
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
