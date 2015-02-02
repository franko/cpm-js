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

function matchFactors(t, i, values) {
    var match = 0;
    var kno = values.length;
    for (var k = 0; k < kno; k++) {
        var j = values[k].column, xval = values[k].value;
        if (t.e(i, j) === xval) {
            match += 1;
        }
    }
    return (match == kno);
}

function sumOccurrences(t, values, y) {
    var sum = 0;
    for (var i = 1; i <= t.nrows; i++) {
        var yi = y ? y.e(i, 1) : 1;
        sum += matchFactors(t, i, values) ? yi : 0;
    }
    return sum;
}

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

function buildFactorSumVector(tab, factors, y) {
    var Kd = [];
    for (var p = 0; p < factors.length; p++) {
        var s = sumOccurrences(tab, factors[p], y)
        Kd.push(s);
    }
    return Sylvester.Vector.create(Kd);
}

function evalExpected(factors, estimates, tab) {
    var Yd = [];
    for (var i = 1; i <= tab.nrows; i++) {
        var sum = 0;
        for (var p = 0; p < factors.length; p++) {
            var match = matchFactors(tab, i, factors[p]);
            sum += match ? estimates.e(p+1) : 0;
        }
        Yd.push(sum);
    }
    return Sylvester.Vector.create(Yd);
}

sige_th = DataFrameView.create(sige, 1, 8, sige.nrows, 1);
for (var i = 1; i <= 10; i++) {
    console.log("sige_th:", sige_th.e(i, 1));
}

var cpm_factors = [
    []
];

for (var site = 2; site <= 17; site++) {
    cpm_factors.push([{column: 5, value: site}]);
}

var tools = ['QFX1001', 'QFX1002', 'QFX1003', 'QFX1006']
for (var k = 1; k < tools.length; k++) {
    cpm_factors.push([{column: 4, value: tools[k]}]);
}

var K = buildFactorMatrix(sige, cpm_factors);
var S = buildFactorSumVector(sige, cpm_factors, sige_th);
var est = K.inverse().multiply(S); // Estimates.
var Yest = evalExpected(cpm_factors, est, sige);
console.log(est.inspect());
console.log(Yest.inspect());
