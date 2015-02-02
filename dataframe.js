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

    indexOf: function(i, j) {
        return (i-1)*this.ncols + (j-1);
    },

    e: function(i, j) {
        return this.data[(i-1)*this.ncols + (j-1)];
    }
};

DataFrameView = function() { };

DataFrameView.create = function(Tsrc, i0, j0, nrows, ncols) {
    var T = new DataFrameView();
    T.setView(Tsrc, i0, j0, nrows, ncols);
    return T;
};

DataFrameView.prototype = {
    setView: function(Tsrc, i0, j0, nrows, ncols) {
        this.data = Tsrc.data;
        this.start = Tsrc.indexOf(i0, j0);
        this.stride = Tsrc.ncols;
        this.nrows = nrows;
        this.ncols = ncols;
    },

    e: function(i, j) {
        return this.data[this.start + (i-1)*this.stride + (j-1)];
    }
};

function sumOccurrences(t, values, y) {
    var sum = 0;
    var kno = values.length;
    for (var i = 1; i <= t.nrows; i++) {
        var match = 0;
        for (var k = 0; k < kno; k++) {
            var j = values[k].column, xval = values[k].value;
            if (t.e(i, j) === xval) {
                match += 1;
            }
        }
        if (y) {
            sum += (match == kno ? y.e(i, 1) : 0);
        } else {
            sum += (match == kno ? 1 : 0);
        }
    }
    return sum;
}

var t = DataFrame.create(3, 2, ['boo', 3, 'foo', 3.14, 'data', -1.15]);
var sige = DataFrame.create(1020, 9, cpm_sige_data)

function buildFactorMatrix(tab, factors) {
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
}

var cpm_factors = [
    [{column: 4, value: 'QFX1001'}, {column: 5, value: 1}]
];

for (var site = 2; site <= 17; site++) {
    cpm_factors.push([{column: 5, value: site}]);
}

var tools = ['QFX1001', 'QFX1002', 'QFX1003', 'QFX1006']
for (var k = 1; k < tools.length; k++) {
    cpm_factors.push([{column: 4, value: tools[k]}]);
}

var K = buildFactorMatrix(sige, cpm_factors);
console.log(K.inspect());
console.log("count:", sumOccurrences(sige, cpm_factors[17]));
console.log(">>", t.e(2,1), t.e(2, 2));
