var Player = Java.type('org.bukkit.entity.Player');
var UUID = Java.type('java.util.UUID');
var Bukkit = Java.type('org.bukkit.Bukkit');
var Location = Java.type('org.bukkit.Location');
var Vector = Java.type('org.bukkit.util.Vector');
var Particle = Java.type('org.bukkit.Particle');
var MetadataValue = Java.type('org.bukkit.metadata.MetadataValue');
var LivingEntity = Java.type('org.bukkit.entity.LivingEntity');

try {
 // player объект доступен напрямую в Tick
 var metaKey = "telekinetic_mob_uuid";

 if (player.hasMetadata(metaKey)) {
  var metaValue = player.getMetadata(metaKey).get(0);
  var uuidString = metaValue.asString();

  try {
   var mobUUID = UUID.fromString(uuidString);
   var mob = Bukkit.getEntity(mobUUID);

   if (mob != null && mob instanceof LivingEntity) {
    // Телепортируем моба перед игроком
    var playerEyeLoc = player.getEyeLocation();
    var direction = playerEyeLoc.getDirection();
    var targetLocation = playerEyeLoc.add(direction.multiply(3.0));
    mob.teleport(targetLocation);

    // Эффект удержания
    player.getWorld().spawnParticle(Particle.SOUL, mob.getLocation(), 10, 0.2, 0.2, 0.2, 0.0);
   } else {
    // Моб исчез, убираем метаданные
    player.removeMetadata(metaKey, plugin);
    // player.sendMessage("§cМоб исчез (Tick cleanup)."); // Слишком спамит
   }
  } catch (e) {
   // player.sendMessage("§cОшибка в Tick: " + e.message); // Слишком спамит
   // В Tick лучше не спамить сообщениями об ошибках игроку
  }
 }
} catch (e) {
 // player.sendMessage("§cПроизошла ошибка в Tick: " + e.message); // Слишком спамит
 // В Tick лучше не спамить сообщениями об ошибках игроку
}
