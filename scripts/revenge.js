const EMPTY = 0;
const PLAYER = 1;
const WALL = 2;  // immovable
const ENEMY = 3;
const BLOCK = 4; // movable block, sokoban style
const PICKUP = 5;
const ENEMY_TRAPPED = 6;

class Revenge extends Grid {
    cssClassMap = {
        0: 'empty',
        1: 'player',
        2: 'wall',
        3: 'enemy',
        4: 'block',
        5: 'pickup',
        6: 'enemy_trapped'
    };

    constructor() {
        let rows = 23;
        let columns = 23;

        super(rows, columns);

        this.enemies = [];
        this.currentLevel = 0;  // TODO: get from query params or something

        let state = this.displayStateCopy();

        for (let x = 0; x < this.columns; x += 1) {
            for (let y = 0; y < this.rows; y += 1) {
                // load initial map state
                state[x][y] = levels[this.currentLevel][x][y];

                // also set initial player/enemy positions
                if (state[x][y] === PLAYER) {
                    this.player = { x, y };
                }
            }
        }

        // create initial enemy
        this.spawnEnemy(state);

        this.render(state);

        this.gameOver = false;

        this.score = 0;

        // TODO: display extra lives
        this.extraLives = 2;

        // listen for player input
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        const gridRef = document.querySelector('#grid');
        grid.addEventListener('touchstart', this.onTouchStart.bind(this));
        grid.addEventListener('touchend', this.onTouchEnd.bind(this));

        // update enemy state independently of player movement
        window.setInterval(this.moveEnemies.bind(this), 1000);
    }

    moveEnemies() {
        let state = this.displayStateCopy()

        // TODO: move these function definitions out of the method?
        const adjacentSquares = ({x, y}) => {
            const withinBounds = ({ x, y }) => x >= 0 && x < this.columns && y >= 0 && y < this.rows;

            return [
                {x: x - 1, y: y - 1},
                {x: x, y: y - 1},
                {x: x + 1, y: y - 1},
                {x: x - 1, y: y},
                {x: x + 1, y: y},
                {x: x - 1, y: y + 1},
                {x: x, y: y + 1},
                {x: x + 1, y: y + 1},
            ].filter(withinBounds);
        };

        // square containing the player is considered "empty", as we want the enemy to try to move there and git 'im!
        const isEmpty = square => [EMPTY, PLAYER].includes(state[square.x][square.y]);

        const closerToPlayer = (a, b) => {
            // very basic distance formula
            return Math.abs(this.player.x - a.x) + Math.abs(this.player.y - a.y) >
                Math.abs(this.player.x - b.x) + Math.abs(this.player.y - b.y);
        };

        const move = enemy => {
            let possibleMoves = adjacentSquares(enemy).filter(isEmpty).sort(closerToPlayer);

            if (possibleMoves.length === 0) {
                state[enemy.x][enemy.y] = ENEMY_TRAPPED;
                return false;
            }

            let next = possibleMoves.shift();

            // check collision with player
            if (state[next.x][next.y] === PLAYER) {
                // TODO: game over
                alert('Game over, man!');
            }

            // remove enemy from where they were
            state[enemy.x][enemy.y] = EMPTY;

            // update enemy ref
            enemy.x = next.x;
            enemy.y = next.y;

            // put enemy where they are now
            state[enemy.x][enemy.y] = ENEMY;

            return true;
        };

        // array of booleans (whether each enemy could move)
        let enemiesMoved = this.enemies.map(move);

        // array contains only `false` values -- meaning all enemies are trapped
        if (enemiesMoved.every(val => !val)) {
            // convert all enemies to pickups
            this.enemies.forEach(enemy => state[enemy.x][enemy.y] = PICKUP);

            // clear out current enemy list
            this.enemies = [];

            // generate two more baddies
            this.spawnEnemy(state);
            this.spawnEnemy(state);
        }

        this.render(state);
    }

    spawnEnemy(state) {
      // randomly choose spawn point
      const spawnPoints = [
        { x: 1, y: Math.floor(this.rows / 2) }, // left
        { x: this.columns - 3, y: Math.floor(this.rows / 2) }, // right
        { x: Math.floor(this.columns / 2), y: 1 },  // top
        { x: Math.floor(this.columns / 2), y: this.rows - 3 } // bottom
      ];

      let enemy = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

      while (state[enemy.x][enemy.y] !== EMPTY) {
        enemy.x += 1;

        // wrap around if we still can't find a place
        if (enemy.x >= this.columns) {
          enemy.x = 1;
          enemy.y += 1;
        }
      }

      state[enemy.x][enemy.y] = ENEMY;

      this.enemies.push(enemy);
    }

    move(diff) {
      let next = {
          x: this.player.x + diff.x,
          y: this.player.y + diff.y
      };

      let state = this.displayStateCopy();

      // unhindered movement
      if (state[next.x][next.y] === EMPTY || state[next.x][next.y] === PICKUP) {
          // remove player from where they were
          state[this.player.x][this.player.y] = EMPTY;

          // update player ref
          this.player.x = next.x;
          this.player.y = next.y;

          if (state[next.x][next.y] === PICKUP) {
              this.score += 100;
              this.renderScore();
          }

          // put player where they are now
          state[this.player.x][this.player.y] = PLAYER;
      }

      // move blocks
      if (state[next.x][next.y] === BLOCK) {
          // check all the adjacent squares in the direction the player is moving
          // if we hit an empty space, then all the blocks can be shifted in that direction
          // if we hit a wall, then return false
          const moveBlock = (state, position, diff) => {
              let next = {
                  x: position.x + diff.x,
                  y: position.y + diff.y
              };

              if ([EMPTY, PICKUP].includes(state[next.x][next.y])) {
                  // move the current block into the next space
                  state[next.x][next.y] = BLOCK;

                  // allow subsequent moves to proceed
                  return true;
              } else if (state[next.x][next.y] === BLOCK) {
                  if (moveBlock(state, next, diff)) {
                      // move the current block into the next space
                      state[next.x][next.y] = BLOCK;

                      // allow subsequent moves to proceed
                      return true;
                  }
              } else {
                  // if there's anything else in the way, then fail
                  console.log(`Can't move block; ${this.cssClassMap[state[next.x][next.y]]} is in the way`);
                  return false;
              }
          };

          // moving the entire row of blocks succeeded;
          // the player can now move into `next`
          if (moveBlock(state, next, diff)) {
              // remove player from where they were
              state[this.player.x][this.player.y] = EMPTY;

              // update player ref
              this.player.x = next.x;
              this.player.y = next.y;

              // put player where they are now
              state[this.player.x][this.player.y] = PLAYER;
          }
      }

      this.render(state);
    }

    onKeyDown(event) {
        if (this.gameOver) {
            return;
        }

        let diff = { x: 0, y: 0 };

        switch (event.key) {
            case 'a':
            case 'ArrowLeft':
                diff.x -= 1;
                break;
            case 'd':
            case 'ArrowRight':
                diff.x += 1;
                break;
            case 'w':
            case 'ArrowUp':
                diff.y -= 1;
                break;
            case 's':
            case 'ArrowDown':
                diff.y += 1;
                break;
        }

        this.move(diff);
    }

    onTouchStart(event) {
      // store where the player first touched the screen
      this.currentTouch = event.changedTouches[0];  // only care about the first touch
    }

    onTouchEnd(event) {
      // store local ref to last touch
      const endTouch = event.changedTouches[0];

      let xDiff = endTouch.clientX - this.currentTouch.clientX;
      let yDiff = endTouch.clientY - this.currentTouch.clientY;

      let diff = { x: 0, y: 0 };

      // if player just tapped without swiping a direction,
      if (Math.abs(xDiff) + Math.abs(yDiff) < 10) {
        // TODO: determine what quadrant of screen was tapped;

      // player moved their finger horizontally more than vertically
      } else if (Math.abs(xDiff) > Math.abs(yDiff)) {
        // user moved their finger (mostly) right
        if (xDiff > 0) {
          // move right
          diff.x += 1;
        } else {
          //  move left
          diff.x -= 1;
        }
      // player moved their finger vertically more than horizontally
      } else {
        if (yDiff > 0) {
          // move down
          diff.y += 1;
        } else {
          // move up
          diff.y -= 1;
        }
      }

      this.move(diff);
    }

    renderScore() {
      document.querySelector('#score').textContent = this.score;
    }

    displayGameOver() {
        window.alert('u lose, bro');
    }
}
