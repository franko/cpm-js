
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

var onLoadFile = function(evt) {
    if (evt.target.readyState == FileReader.DONE) {
        var parser = new FXParser(evt.target.result);
        var dt = parser.readDateTime();
        parser.readAll();
        // renderParameters(parser.tables, onParameterChoice);
    }
};
/*        for (var i = 0, f; f = files[i]; i++) {
            var reader = new FileReader();
            reader.onloadend = onLoadFile;
            reader.readAsText(f);*/

var renderFileListTable = function(files, onComplete) {
    var table = d3.select("#file_select").append("table")
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    thead.append("tr")
        .selectAll("th")
        .data(["Filename", "Tool", "Reprod"])
        .enter()
        .append("th")
            .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(files, function(d) { return d.name; })
        .enter()
        .append("tr");

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
            var tool = "Boo";
            var reprod = 1;
            annFiles.push({file: files[k], tool: tool, reprod: reprod});
        }
        onComplete(annFiles);
    });
};

function onFileSelection(evt) {
    var files = evt.target.files;
    renderFileListTable(files, function() { alert("Boum!"); });
}
