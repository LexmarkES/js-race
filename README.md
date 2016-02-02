# js-race

## Usage
```javascript
var race = require('js-race');
var LoadDriver = race.LoadDriver; //LoadDriver constructor
```

### new LoadDriver(definitions, options)
The options argument is not required.

* `definitions` - an array of use case definitions
* `options`
  * `runtime_s` - test length in seconds, default: 300 (5 min)
  * `metrics_interval_ms` - metrics output interval in milliseconds, default: 60000 (60 seconds)
  * `metrics_path` - metrics file path, default: ./metrics.tsv

### Use Case Definition
The use case definition is an object with the following properties:

* `name` - a string used to identify the use case for metrics tracking; should be a valid javascript variable name
* `browserOpts` - an array of objects that specify the type and number of browser instances to generate for the test
    * `type` - `"firefox"`, `"chrome"`, or `"phantomjs"`; the webdriver compatible browser to use for the test
    * `count` - the number of browser instances to create
* `allowedFailures` - the number of failures to handle before failing and stopping the test
* `actions` - array of action definitions

Example:
```javascript
var useCaseDef = {
    name: "example-use-case",
    browserOpts: [
        {type:'firefox', count: 1},
        {type:'chrome', count: 1},
        {type:'phantomjs', count: 1}
    ],
    allowedFailures: 0,
    actions: [{...}]
};
```

### Action Definition
Each action has three properties: a string `name`, a function `execute`, and an optional function `validator`.

* `name` - a string used to identify the action for metrics tracking; should be a valid javascript variable name
* `execute` - A function that is the "work" of the action. When the load driver executes an action, it is executing this code. The execute function is passed a webdriver.io browser object by the load driver which can be used to manipulate the current web page. The API documentation for building the function using webdriver.io can be found [here](http://webdriver.io/api.html). Because webdriver.io is A+ promise certified all functions are thenable allowing you to chain multiple webdriver.io actions together easily. 
 __Note__: When writing actions it is important to remember that the metrics are tracked based on the duration of the actions, because of this it is important to return a promise that will resolve when the action can be considered finished. Often this returned promise will include one of the webdriver.io waitFor functions as the last step in the action execute function to make sure the action completes when a page element (found using a css selector) exists or is actionable.
* `validator` - An optional function that is run after the main action `execute` function. This function must return `true` if the validation passes, otherwise it will be considered an error. The time taken to execute the validator is not captured by metrics tracking.
 The validator function is useful to ensure the state of the page or correctness after an action has been completed. For example: an action may execute a search form and wait for the first result to return. The validator may then check all results for a specific ordering. 

Example:

```javascript
{
    name: 'login',
    execute: browser => {
        return browser
            .setValue('#txtLogin', 'test1')
            .setValue('#txtPassword', 'ImageNow!')
            .click('#btnLogin')
            .waitForExist('.item-content', 5 * 1000);
    },
    validator: browser => {
        return browser.isExisting("#someAdminButton"); //ensure we ar logged in as an administrator
    } 
}
```

### Test Types
The load driver currently has one test type, __race__.

#### race
The load driver will start up N browser instances where N is the sum of `poolSize` of provided use case definitions.  The load driver will then start one use case instance per driver which will then be run in a loop.  

This mode is useful for seeing how many use case instances can run in a given amount of time.  All use case instances run as fast as possible.

## Load Driver Outputs

### Logs
js-race uses a default console logger that has five levels (ERROR, WARN, INFO, DEBUG, TRACE). 

The default logger can be configured to use a logger of choice by creating a new logger object and setting the logging functions equal to functions of the desired logger then using the `setLogger()` function in race to implement the new logger.

Example using Winston.js:

```javascript
var race = require('js-race');
var winston = require('winston');

winston.add(winston.transports.File, {filename: 'testing.log'});

var newLogger = {
    error: winston.error,
    warn: winston.warn
    info: winston.info
    debug: winston.debug
    trace: winston.trace
};
race.setLogger(newLogger);
```

### Screenshots
js-race attempts to create a screenshot of the browser when errors are thrown while executing a use case.  These screenshots are named with the following convention: 
```<USE CASE INSTANCE NAME & #>_<ACTION NAME>_<TYPE>.png```

__TYPE__ can have the following values:
* EXE - error during action execution
* VALX - error during validation execution
* VAL - validation function returned non-true value

### Metrics
js-race produces a "perfstat-like" metrics file.  These files are tab delimited and include a header line at the beginning of the file.  The metrics are aggregated by use case, action, and minute.  An additional metric is reported per use case named ALL_ACTIONS which represents the sum of the actions performed for a particular use case.

Actions are aggregated into the minute at which they end.  Therefore, if an action started at minute 1 but finished during minute 2 then the action will be aggregated into minnute 2.  The ALL_ACTIONS metric follows similar logic and is aggregated into the minute at which the use case has completed.  An action must complete successfully to be tracked by the metrics system.  If an action fails then that use case instance and its remaining actions will not be included in the ALL_ACTIONS metric.

__metrics.tsv__ columns:

| Column | Description |
| --- | --- |
| TIMESTAMP | ISO8601 timestamp, the time at which metrics were aggregated |
| EPOCH | Unix timestamp version of the TIMESTAMP column, provided for automated metrics consumption |
| USECASE | name of the use case |
| ACTION | name of the action, a value of ALL_ACTIONS is a special value which indicates the sum of all action metrics for a particular use case instance |
| TOTAL | sum, in seconds |
| NUM | count |
| AVG | average, in seconds |
| STD_DEV | standard deviation, in seconds |
| MIN | smallest reported value, in seconds |
| MAX | largest reported value, in seconds |