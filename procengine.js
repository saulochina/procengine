/**
 * ProcEngine v1.0.0
 * @author Ahmed Khalifa (Amidos)
 */
var procengine = {
  ////////////////////////////Data Members//////////////////////////////////////
  /**
   * testing information for the system
   */
  testing:{
    /**
    * to make sure people call Initialize function before generate
    */
    isInitialized: false,
    /**
    * for debugging the engine
    */
    isDebug: true
  },
  /**
   * contains the initial information about the generated map
   */
  mapData: {
    /**
    * the size of the map [width x height]
    */
    mapSize: [],
    /**
    * the tile used to fill the map
    */
    mapStart: -1,
    /**
    * the tile used to dig through the map
    */
    mapDig: -1
    
  },
  /**
   * 
   */
  diggerInfo: {
    /**
     * 
     */
    diggingType: -1,
    /**
     * 
     */
    diggingData: [],
    /**
    * number of rooms to be generated in the level
    */
    roomNumber: -1
  },
  /**
   * how to handle unconnected parts
   */
  handlingUnconnected: {
    /**
    * handling the unconnected areas
    */
    unconnected: -1,
    /**
    * checking unconnected areas
    */
    connectionType: [[]],
    /**
     * how thick is the connection between two rooms
     */
    connectionThickness: 1
  },
  /**
   * the names and neighbourhoods idendified by the user
   */
  identifiedNames:{
    /**
    * dictionary contains all defined names and coressponding ids
    */
    namesIndex: {},
    /**
    * dictionary contains all defined ids and coressponding names
    */
    indexNames: {},
    /**
    * dictionary for all the defined neigbourhoods
    */
    neigbourhoods: {}
  },
  /**
  * contains all the information about the cellular automata
  */
  roomAutomata:{
    /**
    * number of simulations for the cellular automata
    */
    simulationNumber: -1,
    /**
    * starting rules that is used to starting distribution
    */
    startingRules: [],
    /**
    * rules for the cellular automata
    */
    rules: []
  },
  /**
  * contains all the information about smoothing cellular automata
  */
  smoothAutomata:{
    /**
    * number of smooth simulations
    */
    simulationNumber: -1,
    /**
    * rules for the smoothing cellular automata
    */
    rules:[]
  },
  ///////////////////////////////Classes////////////////////////////////////////
  /**
  * ConditionType is an enumarator with two values "in" or "out"
  */
  ConditionType: {
    "in": 0,
    "out": 1
  },
  /**
  * Type to treat isolated areas
  */
  Unconnected: {
    "connect":0,
    "delete":1
  },
  /**
   * used to determine the type of map division
   */
  DiggingType: {
    "equal": 0,
    "tree": 1
  },
  /**
  * ReplacingRule class contains data about inserting a tile using probabilities
  * @param dataLine {string} "tile:probability"
  * @member tile {Number} the tile that should appear in a specific tile
  * @member probability {Number} the probability of this tile to show
  * @function toString {function} return a string that contains all the data
  */
  ReplacingRule: function(dataLine){
    var pieces = dataLine.split(":");
    this.tile = procengine.identifiedNames.namesIndex[pieces[0].trim().toLowerCase()];
    this.probability = parseFloat(pieces[1].trim());
    this.toString = function(){
      return procengine.identifiedNames.indexNames[this.tile] + " " + this.probability.toString();
    };
  },
  /**
  * Rule class contains data about cellular automata rules
  * @param dataLine {string} "tile,neighbourhood,checkTile,conditionType,
  *                           lowBoundary,highBoundary,ReplacingRule|
  *                           ReplacingRule|..."
  * @member tile {Number} if the current x,y is this tile
  * @member neighbourhood {Number[][]} the positions of tiles to check
  * @member checkTile {Number} the tile type to check
  * @member conditionType {ConditionType} in "lowBoundary<value<highBoundary" or
  *                                       out "lowBoundary>value<highBoundary"
  * @member lowBoundary {Number} the lower bound condition
  * @member highBoundary {Number} the high bound condition
  * @member replacingRules {ReplacingRule[]} the rules that are used in applying
  * @function toString {function}
  */
  Rule: function(dataLine){
    var pieces = dataLine.split(",");
    this.tile = procengine.identifiedNames.namesIndex[pieces[0].trim().toLowerCase()];
    this.neighbourhood = procengine.identifiedNames.neigbourhoods[pieces[1].trim().toLowerCase()];
    this.checkTile = procengine.identifiedNames.namesIndex[pieces[2].trim().toLowerCase()];
    this.conditionType = procengine.ConditionType[pieces[3].trim().toLowerCase()];
    this.lowBoundary = parseInt(pieces[4].trim().toLowerCase());
    this.highBoundary = parseInt(pieces[5].trim().toLowerCase());
    pieces = pieces[6].split("|");
    this.replacingRules = [];
    for (var i = 0; i < pieces.length; i++) {
      this.replacingRules.push(new procengine.ReplacingRule(pieces[i]));
    }
    procengine.fixRulesProbability(this.replacingRules,
      procengine.getTotalProbability(this.replacingRules));
    this.toString = function(){
      return procengine.identifiedNames.indexNames[this.tile] + " " +
        procengine.identifiedNames.indexNames[this.checkTile] + " " + this.conditionType + " " +
        this.lowBoundary.toString() + " " + this.highBoundary.toString() + " [" +
        this.replacingRules.toString() + "]";
    };
  },
  /**
  * Point data structure
  * @param x
  * @param y
  * @member x
  * @member y
  * @function clone
  */
  Point: function(x, y){
    this.x = x;
    this.y = y;
    this.clone = function(){
      return new procengine.Point(this.x, this.y);
    }
  },
  /**
  * Rectangle class to handle a rectangle data
  * @param x {Number} x position for the rectangle
  * @param y {Number} y position for the rectangle
  * @param width {Number} rectangle width
  * @param height {Number} rectangle height
  * @member x {Number} x position for the rectangle
  * @member y {Number} y position for the rectangle
  * @member width {Number} rectangle width
  * @member height {Number} rectangle height
  */
  Rectangle: function(x, y, width, height){
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  },
  //////////////////////////Private Functions///////////////////////////////////
  /**
  * Gets a random integer number
  * @param max {Number} maximum boundary
  * @return {Number} random integer number
  */
  randomInt: function(max){
    return Math.floor(Math.random() * max);
  },
  /**
  * get the sign of the number
  * @param number {Number} the current number to check
  * @return {Number} the sign of the number (+1, -1, 0)
  */
  sign: function(number){
    if(number > 0) return 1;
    if(number < 0) return -1;
    return 0;
  },
  /**
  * get the biggest label in the map
  * @param labeledPoints {Point[][]} the labeledPoints on the map
  * @return {Number} the label of the largest area
  */
  getBiggestLabel(labeledPoints){
    var result = -1;
    var maxLength = 0;
    for (var i = 0; i < labeledPoints.length; i++) {
      if(labeledPoints[i].length > maxLength){
        result = i;
        maxLength = labeledPoints[i].length;
      }
    }
    return result;
  },
  /**
  * Check if the x and y are in the array
  * @param x {Number} the x position to Check
  * @param y {Number} the y position to Check
  * @param array {Point[]} the array to Check
  * @return {boolean} if the point exisits in the array
  */
  pointInArray: function(x, y, array){
    for (var i = 0; i < array.length; i++) {
      if(x == array[i].x && y == array[i].y){
        return true;
      }
    }
    return false;
  },
  /**
  * append the second array to the first array
  * @param array1 {Obejct[]} first array
  * @param array2 {Object[]} second array
  */
  appendArray(array1, array2){
    for (var i = 0; i < array2.length; i++) {
      array1.push(array2[i]);
    }
  },
  /**
  * Get the total sum of probability attribute in the rules array
  * @param rules {ReplacingRule[]} an array of ReplacingRule
  * @return {Number} total sum of probabilities of the replacing rules
  */
  getTotalProbability: function(rules){
    var totalValue = 0;
    for (var i = 0; i < rules.length; i++) {
      totalValue += rules[i].probability;
    }
    return totalValue;
  },
  /**
  * Changing the values to probabilities
  * @param rules {ReplacingRule[]} an array of ReplacingRule
  * @param totalValue {Number} the total summation of probabilities in the rules
  */
  fixRulesProbability: function(rules, totalValue){
    for (var i = 0; i < rules.length; i++) {
      rules[i].probability /= totalValue;
    }
  },
  /**
  * parse neighbourhood data into 2D matrix
  * @param dataLine {string} a comma separated string for each row in the matrix
  * @return {Number[][]} 2D matrix of 1s and 0s which define the neighbourhood
  */
  parseNeighbourhood: function(dataLine){
    var pieces = dataLine.split(",");
    var result = [];
    for(var j=0; j<pieces.length; j++){
      var line = pieces[j];
      result.push([]);
      for(var i=0; i<line.length; i++){
        var bit = parseInt(line.trim().charAt(i));
        result[result.length - 1].push(bit);
      }
    }
    return result;
  },
  /**
  * Flood fill the map starting from the point x, y
  * @param map {Number[][]} the current labeled map
  * @param x {Number} the current x position to flood
  * @param y {Number} the current y position to floodFill
  * @param connection {Number[][]} connection type
  * @param currentLabel {Number} the current label
  */
  floodFill: function(map, x, y, connection, currentLabel){
    if(x < 0 || y < 0 || x >= map[0].length || y >= map.length || map[y][x] != 0){
      return;
    }
    map[y][x] = currentLabel;
    var center = new procengine.Point(Math.floor(connection[0].length / 2),
      Math.floor(connection.length / 2));
    for (var i = 0; i < connection.length; i++) {
      for (var j = 0; j < connection[i].length; j++) {
        if(connection[i][j] == 1){
          procengine.floodFill(map, x + j - center.x, y + i - center.y,
            connection, currentLabel);
        }
      }
    }
  },
  /**
  * label the map and get the results
  * @param map {Number[][]} the current map
  * @param connection {Number[][]} direction of connection for tiles
  * @param mapStart (Number) the inpassable tile
  * @return {Point[][]} a 2D array contains all the points with labels
  */
  labelMap: function(map, rect, connection, mapStart){
    var tempMap = [];
    for (var y = 0; y < rect.height; y++) {
      tempMap.push([]);
      for (var x = 0; x < rect.width; x++) {
        tempMap[y].push(0);
        if(map[y + rect.y][x + rect.x] == mapStart){
          tempMap[y][x] = -1;
        }
      }
    }

    var currentLabel = 0;
    for (var y = 0; y < tempMap.length; y++) {
      for (var x = 0; x < tempMap[y].length; x++) {
        if(tempMap[y][x] == 0){
          currentLabel += 1;
          procengine.floodFill(tempMap, x, y, connection, currentLabel);
        }
      }
    }

    var result = [];
    for (var i = 0; i < currentLabel; i++) {
      result.push([]);
    }

    for (var y = 0; y < tempMap.length; y++) {
      for (var x = 0; x < tempMap[y].length; x++) {
        if(tempMap[y][x] != -1){
          result[tempMap[y][x] - 1].push(new procengine.Point(x + rect.x, y + rect.y));
        }
      }
    }

    return result;
  },
  /**
  * debugging printing function
  * @param map {Number[][]} the current map
  */
  printDebugMap: function(map){
    if(!procengine.testing.isDebug){
      return;
    }

    var result = "";
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[y].length; x++) {
        if(map[y][x] < 0) {
          result += "#";
        }
        else{
          result += map[y][x].toString();
        }
      }
      result += "\n";
    }
    console.log(result);
  },
  /**
  * generate the starting map
  * @return {Number[][]} 2D array of mapStart tile index
  */
  getStartingMap: function(){
    var map = [];
    for (var y = 0; y < procengine.mapData.mapSize[1]; y++) {
      map.push([]);
      for (var x = 0; x < procengine.mapData.mapSize[0]; x++) {
        map[y].push(procengine.mapData.mapStart);
      }
    }
    return map;
  },
  /**
   * Get the rooms using equal splitting
   * @param map {Number[][]} the current map to be modified
   * @param numX {Number} the number of splits in the x axis
   * @param numY {Number} the number of splits in the y axis
   * @param numRooms {Number} the numbers of rooms
   * @returns {Rectangle[]} list of the rooms that 
   */
  getEqualRooms: function(map, numX, numY, numRooms){
    var w = Math.floor(map[0].length / numX);
    var h = Math.floor(map.length / numY);
    var rooms = [];
    for(var x=0; x<numX; x++){
      for(var y=0; y<numY; y++){
        rooms.push(new procengine.Rectangle(x * w + 1, y * h + 1, w - 2, h - 2));
      }
    }

    while(rooms.length > numRooms){
      var i = procengine.randomInt(rooms.length);
      rooms.splice(i, 1);
    }

    return rooms;
  },
  /**
   * Get the rooms using tree based splitting
   * @param map {Number[][]} the current map to be modified
   * @param minW {Number} the minimum width
   * @param minH {Number} the minimum height
   * @param numRooms {Number} the number of rooms
   * @returns {Rectangle[]} list of the rooms after division
   */
  getTreeRooms: function(map, minW, minH, numRooms){
    var rooms = [new procengine.Rectangle(1, 1, map[0].length - 2, map.length - 2)];

    while(rooms.length < numRooms){
      var index = procengine.getSuitableRoom(rooms, minW, minH);
      var r = rooms[index];
      rooms.splice(index, 1);
      if(r.width > r.height){
        if(r.width > 2 * minW){
          var width = minW + procengine.randomInt(r.width - 2 * minW);
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + 1, width - 2, r.height - 2));
          rooms.push(new procengine.Rectangle(r.x + width + 2, r.y + 1, r.width - width - 2, r.height - 2));
        }
        else{
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + 1, r.width/2 - 2, r.height - 2));
          rooms.push(new procengine.Rectangle(r.x + r.width/2 + 2, r.y + 1, r.width/2 - 2, r.height - 2));
        }
      }
      else{
        if(r.height > 2 * minH){
          var height = minH + procengine.randomInt(r.height - 2 * minH);
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + 1, r.width - 2, height - 2));
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + height + 1, r.width - 2, r.height - height - 2));
        }
        else{
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + 1, r.width - 2, r.height/2 - 2));
          rooms.push(new procengine.Rectangle(r.x + 1, r.y + r.height/2 + 2, r.width - 2, r.height/2 - 2));
        }
      }
    }

    return rooms;
  },
  /**
   * get the suitable room to split based on the size (bigger rooms have higher chance)
   * @param rooms {Rectangle[]} list of all rooms
   * @param minW {Number} minimum width to divide
   * @param minH {Number} minimum height to divide
   * @returns {Number} the best room index to split
   */
  getSuitableRoom: function(rooms, minW, minH){
    var suitRooms = [];
    var previousValue = 0;
    for(var i=0; i<rooms.length; i++){
      if(rooms[i].width > minW || rooms[i].height > minH){
        suitRooms.push(new procengine.Point(i, previousValue + rooms[i].width * rooms[i].height));
        previousValue = suitRooms[suitRooms.length - 1].y;
      }
    }

    var randomValue = procengine.randomInt(previousValue);
    for(var i=0; i<suitRooms.length; i++){
      if(randomValue < suitRooms[i].y){
        return suitRooms[i].x;
      }
    }

    return procengine.randomInt(rooms.length);
  },
  /**
  * Dig the map to construct rooms where cellular automata can be applied
  * @param map {Number[][]} the current map to be modified
  * @return {Rectangle[]} array of all the rooms to be adjusted
  */
  getRooms: function(map){
    var rooms = [new procengine.Rectangle(1, 1, procengine.mapData.mapSize[0] - 2, procengine.mapData.mapSize[1] - 2)]
    if(procengine.diggerInfo.diggingType == procengine.DiggingType["equal"]){
      rooms = procengine.getEqualRooms(map, procengine.diggerInfo.diggingData[0], 
        procengine.diggerInfo.diggingData[1], procengine.diggerInfo.roomNumber);
    }
    else if(procengine.diggerInfo.diggingType == procengine.DiggingType["tree"]){
      rooms = procengine.getTreeRooms(map, procengine.diggerInfo.diggingData[0], 
        procengine.diggerInfo.diggingData[1], procengine.diggerInfo.roomNumber);
    }

    return rooms;
  },
  /**
   * connect unconnected objects in a certain room
   * @param map {Number[][]} the current map to be modified
   * @param rect {Rectangle} the current selected room
   * @param fixType {Unconnected} how to handle unconnected areas
   */
  fixUnconnected: function(map, rect, fixType){
    var labeledData = procengine.labelMap(map, rect, procengine.handlingUnconnected.connectionType,
      procengine.mapData.mapStart);
    if(fixType == procengine.Unconnected["delete"]){
      var largestLabel = procengine.getBiggestLabel(labeledData);
      for (var i = 0; i < labeledData.length; i++) {
        if(i == largestLabel){
          continue;
        }
        for (var j = 0; j < labeledData[i].length; j++) {
          var point = labeledData[i][j];
          map[point.y][point.x] = procengine.mapData.mapStart;
        }
      }
    }
    if(fixType == procengine.Unconnected["connect"]){
      while(labeledData.length > 1){
        var i1 = procengine.randomInt(labeledData.length);
        var i2 = (i1 + procengine.randomInt(labeledData.length - 1) + 1) % labeledData.length;
        var p1 = labeledData[i1][procengine.randomInt(labeledData[i1].length)].clone();
        var p2 = labeledData[i2][procengine.randomInt(labeledData[i2].length)].clone();
        if(Math.random() < 0.5){
          labeledData.splice(i1, 1);
        }
        else{
          labeledData.splice(i2, 1);
        }

        if(Math.random() < 0.5){
          var temp = p2;
          p2 = p1;
          p1 = temp;
        }
        if(Math.random() < 0.5){
          procengine.connectPoints(map, p1, p2, new procengine.Point(
            procengine.sign(p2.x - p1.x), 0), procengine.mapData.mapStart,
            procengine.mapData.mapDig, procengine.handlingUnconnected.connectionThickness);
          procengine.connectPoints(map, p1, p2, new procengine.Point(
            0, procengine.sign(p2.y - p1.y)), procengine.mapData.mapStart,
            procengine.mapData.mapDig, procengine.handlingUnconnected.connectionThickness);
        }
        else{
          procengine.connectPoints(map, p1, p2, new procengine.Point(
            0, procengine.sign(p2.y - p1.y)), procengine.mapData.mapStart,
            procengine.mapData.mapDig, procengine.handlingUnconnected.connectionThickness);
          procengine.connectPoints(map, p1, p2, new procengine.Point(
            procengine.sign(p2.x - p1.x), 0), procengine.mapData.mapStart,
            procengine.mapData.mapDig, procengine.handlingUnconnected.connectionThickness);
        }
      }
    }
  },
  /**
  * connect the map between p1 and p2
  * @param p1 {Point} the first position
  * @param p2 {Point} the second position
  * @param dir {Point} the direction of connection
  * @param mapStart {Number} impassable tile
  * @param mapDig {Number} passable tile
  * @param thickness (Number) the thickness of the connection
  */
  connectPoints: function(map, p1, p2, dir, mapStart, mapDig, thickness){
    var startThickness = Math.floor((thickness - 1) / 2);
    if(dir.x != 0){
      while(p1.y + thickness - startThickness <= 0){
        startThickness -= 1;
      }
      while(p1.y + thickness - startThickness >= map.length - 1){
        startThickness += 1;
      }
      while(p1.x != p2.x){
        for(var y=0;y<thickness;y++){
          if(map[p1.y + y - startThickness][p1.x] == mapStart){
            map[p1.y + y - startThickness][p1.x] = mapDig;
          }
        }
        p1.x += dir.x;
      }
    }
    if(dir.y != 0){
      while(p1.x + thickness - startThickness <= 0){
        startThickness -= 1;
      }
      while(p1.x + thickness - startThickness >= map[0].length - 1){
        startThickness += 1;
      }
      while(p1.y != p2.y){
        for(var x=0;x<thickness;x++){
          if(map[p1.y][p1.x + x - startThickness] == mapStart){
            map[p1.y][p1.x + x - startThickness] = mapDig;
          }
        }
        p1.y += dir.y;
      }
    }
  },
  /**
  * Apply cellular automata to couple of rectangles
  * @param map {Number[][]} the map need to be modified
  * @param simNumber {Number} number of simulations
  * @param rects {Rectangle[]} an array of rooms
  * @param startingRules {ReplacingRule[]} the intializing rules for the
  *                     cellular automata
  * @param rules {Rule[]} the cellular automata rules
  */
  applyCellularAutomata: function(map, simNumber, rects, startingRules, rules){
    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      if(startingRules.length > 0){
        procengine.roomInitialize(map, rect, startingRules);
        if(procengine.testing.isDebug){
          console.log("Initializing room " + i.toString() + ":\n");
          procengine.printDebugMap(map);
        }
      }
      for (var s = 0; s < simNumber; s++) {
        procengine.roomSimulate(map, rect, rules);
        if(procengine.testing.isDebug){
          console.log("Room " + i.toString() + " at simulation " + s.toString() + ":\n");
          procengine.printDebugMap(map);
        }
      }
    }
  },
  /**
  * initialize the room based on the starting rules
  * @param map {Number[][]} the current map to be modified
  * @param rect {Rectangle} the current room dimension
  * @param rules {ReplacingRule[]} an array of ReplacingRule to be applied
  */
  roomInitialize: function(map, rect, rules){
    for (var y = rect.y; y < rect.y + rect.height; y++) {
      for (var x = rect.x; x < rect.x + rect.width; x++) {
        procengine.applyRule(map, x, y, rules);
      }
    }
  },
  /**
  * Apply one simulation run on a certain area
  * @param map {Number[][]} the current map
  * @param rect {Rectangle} the specific area need to be altered
  * @param rules {Rule[]} the rules of the cellular automata
  */
  roomSimulate: function(map, rect, rules){
    var tempMap = [];
    for (var i = 0; i < map.length; i++) {
      tempMap.push([]);
      for (var j = 0; j < map[i].length; j++) {
        tempMap[i].push(map[i][j]);
      }
    }

    for (var y = rect.y; y < rect.y + rect.height; y++) {
      for (var x = rect.x; x < rect.x + rect.width; x++) {
        for (var i = 0; i < rules.length; i++) {
          if(procengine.checkRule(map, x, y, rules[i])){
            procengine.applyRule(tempMap, x, y, rules[i].replacingRules);
          }
        }
      }
    }

    for (var y = rect.y; y < rect.y + rect.height; y++) {
      for (var x = rect.x; x < rect.x + rect.width; x++) {
        map[y][x] = tempMap[y][x];
      }
    }
  },
  /**
  * check if the rule can be applied on this tile
  * @param map {Number[][]} the current map
  * @param x {Number} the current x location
  * @param y {Number} the current y location
  * @param rule {Rule} the current rule to check
  * @return true it can be applied and false otherwise
  */
  checkRule: function(map, x, y, rule){
    var centerY = Math.floor(rule.neighbourhood.length / 2);
    var centerX = Math.floor(rule.neighbourhood[0].length / 2);
    var value = 0;
    for (var iy = 0; iy < rule.neighbourhood.length; iy++) {
      for (var ix = 0; ix < rule.neighbourhood[iy].length; ix++) {
        var tempY = y - centerY + iy;
        var tempX = x - centerX + ix;
        if(tempY >= map.length || tempY < 0 || tempX >= map[iy].length || tempX < 0){
          continue;
        }
        if(rule.neighbourhood[iy][ix] != 0 &&
          map[tempY][tempX] == rule.checkTile){
          value += 1;
        }
      }
    }

    if(rule.conditionType == procengine.ConditionType["in"]){
      return value > rule.lowBoundary && value < rule.highBoundary;
    }
    if(rule.conditionType == procengine.ConditionType["out"]){
      return value < rule.lowBoundary || value > rule.highBoundary;
    }
    return false;
  },
  /**
  * Apply a group of replacing rules on a certain tile
  * @param map {Number[][]} the current map
  * @param x {Number} the current x location
  * @param y {Number} the current y location
  * @param rules {ReplacingRule[]} the replacing rules to be applied
  */
  applyRule: function(map, x, y, rules){
    var randomValue = Math.random();
    var amountValue = 0;
    for (var i = 0; i < rules.length; i++) {
      amountValue += rules[i].probability;
      if(randomValue < amountValue){
        map[y][x] = rules[i].tile;
        break;
      }
    }
  },
  /**
  * Get generated map that use maps
  * @param map {Number[][]} the current generated map
  * @param {string[][]} map using the names defined
  */
  getNamesMap: function(map){
    var tempMap = [];
    for (var i = 0; i < map.length; i++) {
      tempMap.push([]);
      for (var j = 0; j < map[i].length; j++) {
        tempMap[i].push(procengine.identifiedNames.indexNames[map[i][j]]);
      }
    }
    return tempMap;
  },
  //////////////////////////Public Functions////////////////////////////////////
  /**
  * initialize the whole framework with new data
  * @param data {Object} have the following fields "mapData", "names",
  *                      "neigbourhoods", "startingRules", "roomRules",
  *                      "smoothRules"
  */
  initialize: function(data){
    procengine.mapData.mapSize = [];
    procengine.mapData.mapStart = 0;
    procengine.mapData.mapDig = 0;
    procengine.diggerInfo.diggingType = procengine.DiggingType["equal"];
    procengine.diggerInfo.diggingData = [];
    procengine.diggerInfo.roomNumber = 1;
    procengine.handlingUnconnected.unconnected = procengine.Unconnected["connect"];
    procengine.handlingUnconnected.connectionType = [[]];
    procengine.handlingUnconnected.connectionThickness = 1;
    procengine.identifiedNames.namesIndex = {};
    procengine.identifiedNames.indexNames = {};
    procengine.identifiedNames.neigbourhoods = {};
    procengine.roomAutomata = {
      simulationNumber: 2,
      startingRules: [],
      rules: []
    };
    procengine.smoothAutomata = {
      simulationNumber:0,
      rules:[]
    };

    if(data.hasOwnProperty("mapData")){
      var sizePieces = data["mapData"][0].toLowerCase().split("x");
      procengine.mapData.mapSize.push(parseInt(sizePieces[0]));
      procengine.mapData.mapSize.push(parseInt(sizePieces[1]));
      var roomPieces = data["mapData"][1].split(":");
      procengine.diggerInfo.diggingType = procengine.DiggingType[roomPieces[0].trim().toLowerCase()];
      sizePieces = roomPieces[1].toLowerCase().split("x");
      procengine.diggerInfo.diggingData.push(parseInt(sizePieces[0]));
      procengine.diggerInfo.diggingData.push(parseInt(sizePieces[1]));
      procengine.diggerInfo.roomNumber = parseInt(roomPieces[2]);
    }
    else{
      procengine.mapData.mapSize.push(15);
      procengine.mapData.mapSize.push(7);
      procengine.diggerInfo.diggingType = procengine.DiggingType["equal"];
      procengine.diggerInfo.diggingData.push(1);
      procengine.diggerInfo.diggingData.push(1);
      procengine.diggerInfo.roomNumber = 1;
    }

    if(data.hasOwnProperty("names")){
      var index = 0;
      for(var i = 0; i < data["names"].length; i++) {
        procengine.identifiedNames.namesIndex[data["names"][i].trim().toLowerCase()] = index;
        procengine.identifiedNames.indexNames[index] = data["names"][i].trim().toLowerCase();
        index+=1;
      }
    }
    else{
      procengine.identifiedNames.namesIndex = {"solid":0, "empty":1};
    }

    if(data.hasOwnProperty("neighbourhoods")){
      for(var key in data["neighbourhoods"]){
        procengine.identifiedNames.neigbourhoods[key.trim().toLowerCase()] =
          procengine.parseNeighbourhood(data["neighbourhoods"][key]);
      }
    }
    else{
      procengine.identifiedNames.neigbourhoods = {
        "plus": procengine.parseNeighbourhood("010,101,010"),
        "all": procengine.parseNeighbourhood("111","101","111")
      };
    }

    if(data.hasOwnProperty("mapData")){
      var intializePieces = data["mapData"][2].split(":");
      procengine.mapData.mapStart = procengine.identifiedNames.namesIndex[intializePieces[0].toLowerCase()];
      procengine.mapData.mapDig = procengine.identifiedNames.namesIndex[intializePieces[1].toLowerCase()];
      var dataPieces = data["mapData"][3].split(":");
      procengine.handlingUnconnected.unconnected = procengine.Unconnected[dataPieces[0].trim().toLowerCase()];
      procengine.handlingUnconnected.connectionType = procengine.identifiedNames.
        neigbourhoods[dataPieces[1].trim().toLowerCase()];
      procengine.handlingUnconnected.connectionThickness = parseInt(dataPieces[2].trim());
    }
    else{
      procengine.mapData.mapStart = procengine.identifiedNames.namesIndex["solid"];
      procengine.mapData.mapDig = procengine.identifiedNames.namesIndex["empty"];
      procengine.handlingUnconnected.unconnected = procengine.Unconnected["connect"];
      procengine.handlingUnconnected.connectionType = [[0,1,0],[1,0,1],[0,1,0]];
      procengine.handlingUnconnected.connectionThickness = 1;
    }

    if(data.hasOwnProperty("startingRules")){
      for(var i = 0; i < data["startingRules"].length; i++) {
        procengine.roomAutomata.startingRules.push(new procengine.ReplacingRule(data["startingRules"][i]));
      }
    }
    else{
      procengine.roomAutomata.startingRules.push(new procengine.ReplacingRule("empty,1"));
    }
    procengine.fixRulesProbability(procengine.roomAutomata.startingRules,
      procengine.getTotalProbability(procengine.roomAutomata.startingRules));

    if(data.hasOwnProperty("roomRules")){
      procengine.roomAutomata.simulationNumber = parseInt(data["roomRules"][0]);
      for(var i = 1; i < data["roomRules"].length; i++) {
        procengine.roomAutomata.rules.push(new procengine.Rule(data["roomRules"][i]));
      }
    }
    else{
      procengine.roomAutomata.simulationNumber = 0;
    }

    if(data.hasOwnProperty("smoothRules")){
      procengine.roomAutomata.simulationNumber = parseInt(data["smoothRules"][0]);
      for(var i = 1; i < data["smoothRules"].length; i++) {
        procengine.smoothAutomata.rules.push(new procengine.Rule(data["smoothRules"][i]));
      }
    }
    else{
      procengine.smoothAutomata.simulationNumber = 0;
    }

    procengine.testing.isInitialized = true;
  },
  /**
  * generate a level based on the intialized data
  * @return {String[][]} a 2d matrix of the defined names
  */
  generateLevel: function(){
    if(!procengine.testing.isInitialized){
      console.log("you must call initialize first");
    }

    var map = procengine.getStartingMap();
    if(procengine.testing.isDebug){
      console.log("After constructing the matrix:\n");
      procengine.printDebugMap(map);
      console.log("Room Automata:\n")
    }
    var rooms = procengine.getRooms(map);
    procengine.applyCellularAutomata(map,
      procengine.roomAutomata.simulationNumber, rooms,
        procengine.roomAutomata.startingRules, procengine.roomAutomata.rules);
    
    for(var i=0; i<rooms.length; i++){
      procengine.fixUnconnected(map, rooms[i], procengine.handlingUnconnected.unconnected);
      if(procengine.testing.isDebug){
        console.log("After using connection Method on Room " + i.toString() + ":\n");
        procengine.printDebugMap(map);
      }
    }

    procengine.fixUnconnected(map, new procengine.Rectangle(1, 1, 
      procengine.mapData.mapSize[0] - 2, procengine.mapData.mapSize[1] - 2), 
      procengine.Unconnected["connect"]);
    if(procengine.testing.isDebug){
      console.log("Connecting rooms:\n");
      procengine.printDebugMap(map);
    }
    
    procengine.applyCellularAutomata(map,
      procengine.smoothAutomata.simulationNumber,
      [new procengine.Rectangle(0, 0, procengine.mapData.mapSize[0],
        procengine.mapData.mapSize[1])], [], procengine.smoothAutomata.rules);
    if(procengine.smoothAutomata.simulationNumber > 0){
        procengine.fixUnconnected(map, new procengine.Rectangle(1, 1, 
          procengine.mapData.mapSize[0] - 2, procengine.mapData.mapSize[1] - 2), 
          procengine.Unconnected["connect"]);
    }
    if(procengine.testing.isDebug && procengine.smoothAutomata.simulationNumber > 0){
        console.log("Smooth Automata:\n");
        procengine.printDebugMap(map);
    }

    return procengine.getNamesMap(map);
  },
  /**
  * get string contains all the data about the generator
  * @return {String} display all the information stored in the engine
  */
  toString: function(){
    return "mapSize: " + procengine.mapData.mapSize[0].toString() + "x" +
                         procengine.mapData.mapSize[1].toString() + "\n" +
      "roomNumber: " + procengine.diggerInfo.roomNumber.toString() + "\n" +
      "diggingType: " + procengine.diggerInfo.diggingType.toString + "\n" +
      "diggingData: " + procengine.diggerInfo.diggingData[0].toString() + "x" +
                        procengine.diggerInfo.diggingData[1].toString() + "x" +
      "Unconnected: " + procengine.handlingUnconnected.unconnected + "\n" +
      "mapStart: " + procengine.identifiedNames.indexNames[procengine.mapData.mapStart] + " mapDig: " +
                     procengine.identifiedNames.indexNames[procengine.mapData.mapDig] + "\n" +
      "names: " + procengine.identifiedNames.indexNames.toString() + "\n" +
      "roomAutomata:\n" +
      "\tsimulationNumber: " + procengine.roomAutomata.simulationNumber.toString() + "\n" +
      "\tstartingRules: [" + procengine.roomAutomata.startingRules.toString() + "]\n" +
      "\trules: [" + procengine.roomAutomata.rules.toString() + "]\n" +
      "smoothAutomata:\n" +
      "\tsimulationNumber: " + procengine.smoothAutomata.simulationNumber.toString() + "\n" +
      "\trules: [" + procengine.smoothAutomata.rules.toString() + "]\n";
  }
};
///////////////////////////////Testing Code/////////////////////////////////////
var data = {
  "mapData": ["24x8", "equal:2x2:4", "solid:empty", "connect:plus:1"],
  "names": ["empty", "solid"],
  "neighbourhoods": {"plus":"010,101,010", "all":"111,101,111"},
  "startingRules": ["solid:1","empty:2"],
  "roomRules": ["2", "empty,all,solid,out,0,5,solid:1"]
};
procengine.initialize(data);
procengine.generateLevel();
