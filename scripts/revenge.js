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
        // wtf is up with this prime row/col count?
        let rows = 23;
        let columns = 23;

        super(rows, columns);

        this.enemies = [];

        let state = this.displayStateCopy();

        for (let x = 0; x < this.columns; x += 1) {
            for (let y = 0; y < this.rows; y += 1) {
                // load initial map state
                // TODO: hardcoded level 1
                state[x][y] = levels[0][x][y];

                // also set initial player/enemy positions
                if (state[x][y] === PLAYER) {
                    this.player = { x, y };
                }

                if (state[x][y] === ENEMY) {
                    this.enemies.push({ x, y });
                }
            }
        }

        this.render(state);

        this.gameOver = false;

        // TODO: display score somewhere
        this.score = 0;

        // listen for player input
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        const gridRef = document.querySelector('#grid');
        grid.addEventListener('touchstart', e => console.log('TODO touchstart'));

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

            // TODO: spawn new enemies and/or increment level
            this.enemies = [];
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
                console.log(`Score: ${this.score}`);
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

    displayGameOver() {
        window.alert('u lose, bro');
    }
}
