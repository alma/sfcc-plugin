/**
 * A forOf function to mimic for..of . :')
 * @param {array|Object} iterable any iterable item
 * @param {function} predicate any predicate function that will take an array iterator
 */
function forOf(iterable, predicate) {
    if (typeof iterable.iterator === 'function') {
        var iter = iterable.iterator();
        while (iter.hasNext()) {
            var item = iter.next();
            predicate(item);
        }
        return;
    }

    var keys = Object.keys(iterable);

    // TODO: muting no-plusplus rule until we refactor more efficiently the code to match Node >=22
    // eslint-disable-next-line no-plusplus
    for (var i = 0, l = keys.length; i < l; i++) {
        predicate(iterable[keys[i]]);
    }
}

/**
 * A filter function to mimic .filter to pretend we have a modern dev env
 * @param {array} arrayToFilter any array
 * @param {function} predicate any predicate function that will take an array iterator and return a boolean
 * @returns {array} the filtered array
 */
function filter(arrayToFilter, predicate) {
    var result = [];

    forOf(arrayToFilter, function (elem) {
        if (predicate(elem)) {
            result.push(elem);
        }
    });

    return result;
}

/**
 * A find function to mimic .find to pretend we have a modern dev env
 * @param {array} haystack any array
 * @param {function} predicate any predicate function that will take an array iterator and return an elem
 * @returns {any|null} an item from the array or null is item is not found
 */
function find(haystack, predicate) {
    var keys = Object.keys(haystack);
    // TODO: muting no-plusplus rule until we refactor more efficiently the code to match Node >=22
    // eslint-disable-next-line no-plusplus
    for (var i = 0, l = keys.length; i < l; i++) {
        if (predicate(haystack[keys[i]])) {
            return haystack[keys[i]];
        }
    }

    return null;
}

/**
 * A map function to mimic .map to pretend we have a modern dev env
 * @param {array} arrayToTransform any array
 * @param {function} predicate any predicate function that will take an array iterator and return any
 * @returns {array} the transformed array
 */
function map(arrayToTransform, predicate) {
    var result = [];

    forOf(arrayToTransform, function (elem) {
        result.push(predicate(elem));
    });

    return result;
}

/**
 * A some function to mimic .some to pretend we have a modern dev env
 * @param {array} haystack any array
 * @param {function} predicate any predicate function that will take an array iterator and return any
 * @returns {boolean} the transformed array
 */
function some(haystack, predicate) {
    return filter(haystack, predicate).length > 0;
}

module.exports = {
    forOf: forOf,
    filter: filter,
    find: find,
    map: map,
    some: some
};
