// src/lib/gen3/PK3_FORMAT.md
# Gen 3 PK3 Format Documentation

## Overview
In Pokémon Generation 3 games (Ruby/Sapphire/Emerald/FireRed/LeafGreen), Pokémon stored in the PC Storage System use an 80-byte data structure called PK3.

## Memory Layout

### Plaintext Header (32 bytes, 0x00-0x1F)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 4 | PID | Personality ID (determines nature, gender, shininess, etc.) |
| 0x04 | 4 | OTID | Original Trainer ID (Trainer ID + Secret ID) |
| 0x08 | 10 | Nickname | Pokémon nickname (Gen 3 encoding, 0xFF padded) |
| 0x12 | 2 | Language | Language ID (0x0201 = English) |
| 0x14 | 7 | OT Name | Original Trainer name (Gen 3 encoding, 0xFF padded) |
| 0x1B | 1 | Markings | Circle/Square/Triangle/Heart marks |
| 0x1C | 2 | Checksum | 16-bit checksum of decrypted 48-byte data block |
| 0x1E | 2 | Unknown | Padding/unused |

### Encrypted Data Block (48 bytes, 0x20-0x4F)
Contains 4 substructures (12 bytes each) that are:
1. **Encrypted** with XOR key = `(PID XOR OTID)`
2. **Shuffled** based on `PID % 24` using a predetermined order table

#### Substructure Order
The shuffling order is determined by `PID % 24` and maps physical positions to logical blocks:
- **Logical Block 0**: Growth (species, held item, EXP, friendship)
- **Logical Block 1**: Attacks (moves, PP)
- **Logical Block 2**: EVs & Condition (EVs, contest stats, Pokérus)
- **Logical Block 3**: Miscellaneous (IVs, met location, ribbons, ability bit)

#### Growth Block (Logical Block 0, 12 bytes)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 2 | Species | Species ID (1-386 for Gen 3), **little-endian** |
| 0x02 | 2 | Held Item | Item ID |
| 0x04 | 4 | Experience | Total EXP points |
| 0x08 | 1 | PP Bonuses | PP Up uses (2 bits per move) |
| 0x09 | 1 | Friendship | Happiness value (0-255) |
| 0x0A | 2 | Unknown | Padding/unused |

#### Attacks Block (Logical Block 1, 12 bytes)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 2 | Move 1 | Move ID |
| 0x02 | 2 | Move 2 | Move ID |
| 0x04 | 2 | Move 3 | Move ID |
| 0x06 | 2 | Move 4 | Move ID |
| 0x08 | 1 | PP 1 | Current PP for Move 1 |
| 0x09 | 1 | PP 2 | Current PP for Move 2 |
| 0x0A | 1 | PP 3 | Current PP for Move 3 |
| 0x0B | 1 | PP 4 | Current PP for Move 4 |

#### EVs & Condition Block (Logical Block 2, 12 bytes)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 1 | HP EV | HP Effort Value |
| 0x01 | 1 | ATK EV | Attack Effort Value |
| 0x02 | 1 | DEF EV | Defense Effort Value |
| 0x03 | 1 | SPE EV | Speed Effort Value |
| 0x04 | 1 | SPA EV | Special Attack Effort Value |
| 0x05 | 1 | SPD EV | Special Defense Effort Value |
| 0x06 | 1 | Coolness | Contest stat |
| 0x07 | 1 | Beauty | Contest stat |
| 0x08 | 1 | Cuteness | Contest stat |
| 0x09 | 1 | Smartness | Contest stat |
| 0x0A | 1 | Toughness | Contest stat |
| 0x0B | 1 | Feel | Contest stat |

#### Miscellaneous Block (Logical Block 3, 12 bytes)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 1 | Pokérus | Pokérus status |
| 0x01 | 1 | Met Location | Where caught/received |
| 0x02 | 2 | Origins Info | Met level (bits 0-6), ball (bits 11-14), OT gender (bit 15) |
| 0x04 | 4 | IVs & More | IVs (5 bits each × 6 stats) + ability bit (bit 31) |
| 0x08 | 4 | Ribbons | Contest ribbons and special ribbons |

### Trailing Data (32 bytes, 0x50-0x6F)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x50 | 4 | Status Condition | In-battle status (unused in PC) |
| 0x54 | 1 | Level | Current level (calculated, not stored in encrypted data) |
| 0x55 | 1 | Pokérus Remaining | Days remaining (unused in PC) |
| 0x56 | 2 | Current HP | Current HP (unused in PC) |
| 0x58 | 2 | Total HP | Max HP stat |
| 0x5A | 2 | Attack | Attack stat |
| 0x5C | 2 | Defense | Defense stat |
| 0x5E | 2 | Speed | Speed stat |
| 0x60 | 2 | Sp. Attack | Special Attack stat |
| 0x62 | 2 | Sp. Defense | Special Defense stat |
| 0x64 | 12 | Unused | Zero padding |

## Species Encoding Examples

Species are stored as **2-byte little-endian** values:
- **Castform (#351)**: `0x015F` → bytes `5F 01`
- **Jirachi (#385)**: `0x0181` → bytes `81 01`
- **Bulbasaur (#1)**: `0x0001` → bytes `01 00`
- **Deoxys (#386)**: `0x0182` → bytes `82 01`

## Checksum Calculation

The checksum is a 16-bit sum of all 24 little-endian words in the **decrypted and unshuffled** 48-byte data block:

```typescript
function checksum16OfPlain48(plain48: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 48; i += 2) {
    sum = (sum + readU16LE(plain48, i)) & 0xFFFF;
  }
  return sum;
}
```

## Decryption Process

1. Read PID (0x00) and OTID (0x04)
2. Calculate key: `key = PID XOR OTID`
3. XOR each 32-bit word in the encrypted block (0x20-0x4F) with the key
4. Determine shuffle order: `order = SUBSTRUCT_ORDERS[PID % 24]`
5. Unshuffle the 4×12-byte blocks to restore logical order
6. Verify checksum against stored value at 0x1C
7. Extract data from logical blocks

## Example: Minimal Valid Castform

```
Hex: 00 00 00 00 00 00 00 00 FF FF FF FF FF FF FF FF 
     FF FF 01 02 FF FF FF FF FF FF FF 00 64 46 00 00 
     5F 01 00 00 00 00 00 00 00 46 00 00 00 00 00 00 
     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 
     00 00 00 00 00 FF 05 00 00 00 00 00 00 00 00 00
```

- PID: 0x00000000
- OTID: 0x00000000
- Nickname: Empty (0xFF padding)
- Language: 0x0201 (English)
- OT Name: Empty (0xFF padding)
- Checksum: 0x4664
- Species: 351 (Castform) at encrypted offset, decrypts to 0x015F
- Level: ~5 (based on 0 EXP and growth rate)

## Save File Storage

In Gen 3 save files (.sav):
- PC data spans **sections 5-13** (9 sections)
- Each section is 0x1000 bytes (4096 bytes)
- Section payload is 0xF80 bytes (3968 bytes)
- Pokémon data starts at offset **+4** in the concatenated payload
- Total storage: **14 boxes × 30 slots = 420 Pokémon**
- Each slot: **80 bytes**

## Legality Considerations

### Valid Species Range
- Gen 3: 1-386 (Bulbasaur to Deoxys)
- Species 0 = No Pokémon (empty slot)
- Species >386 = Invalid (may cause Bad Egg)

### Move Validation
- Gen 3 moves: 1-354
- Species must be able to learn the move via:
  - Level-up
  - TM/HM
  - Egg move (if bred)
  - Move tutor
  - Event distribution

### PID Considerations
- PID determines nature (PID % 25)
- PID determines gender (compare with species gender ratio)
- PID determines shininess (based on TID/SID/PID correlation)
- For event Pokémon (e.g., WISHMKR Jirachi), PID has specific patterns

## References

- Bulbapedia: [Pokémon data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III))
- Project Pokémon: [Gen 3 Save File Structure](https://projectpokemon.org/home/docs/)
- PKHeX: Open-source save editor implementation
