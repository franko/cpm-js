DataFrame = function() { };

DataFrame.create = function(nrows, ncols, data) {
    var T = new DataFrame();
    T.setDimensions(nrows, ncols);
    T.setData(data);
    return T;
};

DataFrame.prototype = {
    setDimensions: function(nrows, ncols) {
        this.nrows = nrows;
        this.ncols = ncols;
    },

    setData: function(data) {
        this.data = data;
    },

    e: function(i, j) {
        return this.data[(i-1)*this.ncols + (j-1)];
    },
};

function countOccurrences(t, values) {
    var count = 0;
    var kno = values.length;
    for (var i = 0; i < t.nrows; i++) {
        var match = 0;
        for (var k = 0; k < kno; k++) {
            var j = values[k].column, xval = values[k].value;
            if (t.e(i, j) === xval) {
                match += 1;
            }
        }
        count += (match == kno ? 1 : 0);
    }
    return count;
}

var t = DataFrame.create(3, 2, ['boo', 3, 'foo', 3.14, 'data', -1.15]);
var sige = DataFrame.create(1020, 9, cpm_sige_data)

var factors = [
    [{column: 4, value: 'QFX1001'}, {column: 5, value: 1}]
];

for (var site = 2; site <= 17; site++) {
    factors.push([{column: 5, value: site}]);
}

var tools = ['QFX1001', 'QFX1002', 'QFX1003', 'QFX1006']
for (var k = 1; k < tools.length; k++) {
    factors.push([{column: 4, value: tools[k]}]);
}

var Kd = [];
for (var p = 0; p < factors.length; p++) {
    var Krow = [];
    for (var q = 0; q < factors.length; q++) {
        var s = 0;
        if (p === q) {
            s = countOccurrences(sige, factors[p]);
        } else {
            var cf = [].concat(factors[p]).concat(factors[q]);
            s = countOccurrences(sige, cf);
        }
        Krow.push(s);
    }
    Kd.push(Krow);
}

var K = Sylvester.Matrix.create(Kd);
console.log(K.inverse().inspect())
console.log("count:", countOccurrences(sige, factors[17]));
console.log(">>", t.e(2,1), t.e(2, 2));
