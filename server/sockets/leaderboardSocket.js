module.exports = (io, redis) => {
  io.on("connection", (socket) => {
    socket.on("score:submit", async ({ userId, score }) => {
      await redis.zadd("leaderboard", score, userId);
      const data = await redis.zrevrange("leaderboard", 0, 20, "WITHSCORES");
      io.emit("leaderboard:update", data);
    });
  });
};
