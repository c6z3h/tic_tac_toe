import { createClient } from '@supabase/supabase-js';

// 1️⃣ Connect to Supabase
const supabaseUrl = "https://hsogyroyrdeddrvglppz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzb2d5cm95cmRlZGRydmdscHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDM2NzcsImV4cCI6MjA1ODkxOTY3N30.iD7rVVSm-x9Fk8OleNPhzf59WsUKh83AY0X2fj5hmMk";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const table_name = 'record';
const channel = supabase.channel(`public:${table_name}`)
const gameLobbyChannel = supabase.channel(`public:game_lobby`);

// Game state
// let currentPlayer: string = "X";
const board: (string | null)[] = Array(9).fill(null); // 3x3 grid
let isGameOver = false;
let canMove = true;

// Start game
joinGame();
subscribeToUpdates();

interface INewPayload {
  created_at: string;
  grid_index: number;
  id: number;
  player: string;
}

// 2️⃣ Subscribe to Realtime Changes
function subscribeToUpdates() {
  channel
    .on('postgres_changes' as unknown as 'system', { event: 'INSERT', schema: 'public', table: table_name }, (payload) => {
      const newUpdate = payload?.new as INewPayload;
      updateUI(newUpdate);
      canMove = newUpdate.player !== localStorage.getItem('playerSymbol');
      console.log('canMove', canMove)
    })
    .subscribe();
}

// 3️⃣ Handle Player Moves
async function handleMove(index: number) {
  console.log('handleMove', canMove)
  if (isGameOver || board[index] !== null || !canMove) return; // Ignore clicks if game is over or cell is filled

  const playerSymbol = localStorage.getItem("playerSymbol") || "X";

  const { error } = await supabase.from(table_name).insert([{ grid_index: index, player: playerSymbol }]);
  if (error) {
      console.error("Database update error:", error.message);
      return;
  }
}
// 4️⃣ Update UI Based on Database Changes
function updateUI(res: INewPayload) {
  const { grid_index, player } = res || {};
  const cell = document.getElementById(`cell-${grid_index}`) as HTMLButtonElement;
  
  if (cell && player) {
      board[grid_index] = player;
      cell.textContent = player;
      checkWinCondition(); // Check if someone won
  }
}

// 5️⃣ Attach Event Listeners to Buttons
document.querySelectorAll("button").forEach((button, index) => {
  button.addEventListener("click", () => handleMove(index));
});

// 6️⃣ Assign Players Using Realtime WebSockets
async function joinGame() {
  let players: string[] = [];

  gameLobbyChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
          console.log("Connected to game_lobby");
          const userName = document.getElementById(`userId`) as HTMLHeadingElement;
          userName.textContent = ' X';

          gameLobbyChannel.send({
              type: "broadcast",
              event: "player_joined",
              payload: { players: [...players, crypto.randomUUID()] },
          });

          // Assign 'X' to first player, 'O' to second
          localStorage.setItem("playerSymbol", players.length === 0 ? "X" : "O");
      }
  });

  gameLobbyChannel.on("broadcast", { event: "player_joined" }, ({ payload }) => {
    updatePlayers(payload.players);
  });
}

function updatePlayers(playersList: any[]) {
  console.log("Updated Players List:", playersList);
  localStorage.setItem('playerSymbol', 'O');
  const userName = document.getElementById(`userId`) as HTMLHeadingElement;
  userName.textContent = ' O';
}

// 7️⃣ Check Win Condition
function checkWinCondition() {
  const winningPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6], // Diagonals
  ];

  for (let pattern of winningPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          isGameOver = true;
          alert(`${board[a]} wins! 🎉`);
          return;
      }
  }

  // Check for draw
  if (board.every(cell => cell !== null)) {
      alert("It's a draw! 🤝");
      isGameOver = true;
  }
}