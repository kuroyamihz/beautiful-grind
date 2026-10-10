// Offline event templates. Each event can pose a decision; the choice is resolved
// at the start of the next week (consequences are honest, not always good).
import { chance, pick, randint } from './util.js';
import { personName, statLabel, relevantStats } from './player.js';

const clubTag = (c) => c.replace(/[^A-Za-z0-9]/g, '');

export const TEMPLATES = [
  // ───────────────────────── DAY ONE ─────────────────────────
  {
    id: 'first_day', type: 'personal', weight: () => 0,
    build: (s, c) => ({
      headline: `${c.J}, 16, Steps Into ${s.player.club.name}'s First-Team Dressing Room`,
      text: `Monday, 7am. The first-team dressing room smells of liniment and coffee. ${c.J}'s peg is in the corner, next to the kit man's boxes, with a number nobody else wanted: ${s.player.number}. Grown men with mortgages and children walk past him without looking up. ${c.M}, the head coach, shakes his hand once, firmly, and says only: "We'll see." Pre-season starts today.`,
      decision: {
        type: 'personal', prompt: 'First day with the first team. How do you carry yourself?',
        choices: [
          { id: 'a', label: 'Introduce yourself to everyone', description: 'Handshakes around the room, names learned by lunch.', risk: 'low', consequence: 'Some warmth; some will think you are trying too hard.' },
          { id: 'b', label: 'Keep your head down', description: 'Speak with your feet. Carry the cones.', risk: 'low', consequence: 'Respect from the old guard. Easy to be overlooked.' },
          { id: 'c', label: 'Ask the captain for advice', description: 'Find the leader and learn the rules.', risk: 'medium', consequence: 'Could earn a protector — or an eye-roll.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `${d.J} learns twenty-three names before lunch. Most of the squad warm to the kid; one veteran mutters something about "influencers".`, effects: { followers: 300 } }),
      b: (s, d) => ({ text: `${d.J} carries the cones, collects the bibs, says almost nothing all week. On Friday the captain throws him a ball in the rondo without being asked.`, effects: { trust: 2 } }),
      c: (s, d) => chance(0.65)
        ? { text: `The captain looks him up and down, then gives him three rules: never be late, never sulk, never celebrate in training. "Follow those and I'll look after you."`, effects: { teammate: { name: s.player.keyTeammates[0]?.name ?? 'The captain', rel: 'ally' }, growth: ['mental'] } }
        : { text: `The captain is polite and busy and forgets the conversation by Wednesday.`, effects: {} },
    },
  },

  // ───────────────────────── TRAINING ─────────────────────────
  {
    id: 'tactical_role', type: 'training',
    weight: (s, c) => (s.player.club && c.played >= 0 ? 8 : 0),
    build: (s, c) => {
      const roles = { GK: 'sweeper-keeper starting the build-up', CB: 'ball-playing role stepping into midfield', FB: 'inverted full-back tucking inside', DM: 'single pivot screening alone', CM: 'box-to-box role with license to press high', AM: 'false nine dropping between the lines', W: 'wide forward on the opposite flank', ST: 'pressing-trigger role leading the line' };
      return {
        headline: `${c.M} Tests ${c.J} in New Tactical Role`,
        text: `Tuesday's session stops three times. Each time, ${c.M} walks over, takes ${c.J} by the shoulder and moves him two metres. The plan is clear: a ${roles[s.player.position]}. It is not what ${c.J} has played since the academy. Around the pitch, the assistants watch his reaction more than his feet.`,
        decision: {
          type: 'tactical', prompt: `${c.M} wants you in a new role. How do you respond?`,
          choices: [
            { id: 'a', label: 'Embrace it', description: 'Commit fully, stay late with the analysts.', risk: 'medium', consequence: 'Manager trust rises; first weeks may be messy.' },
            { id: 'b', label: 'Ask why', description: 'Request a one-to-one to understand the plan.', risk: 'low', consequence: 'Small trust gain if he likes curiosity — some managers don\'t.' },
            { id: 'c', label: 'Refuse it', description: 'Tell him you are not built for that role.', risk: 'high', consequence: 'Refusing a tactical role badly damages trust.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `${d.J} throws himself into the new role. The analysts send clips at midnight; he watches them all. ${d.M} notices.`, effects: { trust: 4, tacticalFit: 10, growth: ['mental'] } }),
      b: (s, d) => chance(0.65)
        ? { text: `The one-to-one goes well. ${d.M} draws the shape on a napkin and seems pleased somebody asked.`, effects: { trust: 2, tacticalFit: 5 } }
        : { text: `"Because I said so," is roughly the answer. ${d.M} does not enjoy being questioned.`, effects: { trust: -3 } },
      c: (s, d) => ({ text: `${d.J} says no. ${d.M} nods, says nothing, and leaves him out of the shape work for the rest of the week. The message is received by everyone.`, effects: { trust: -12, mood: 'Angry' } }),
    },
  },
  {
    id: 'physical_breakthrough', type: 'training',
    weight: (s, c) => (c.age <= 26 && !s.player.injury ? 5 : 1),
    build: (s, c) => {
      const stat = pick(['pace', 'physical']);
      return {
        headline: `GPS Data Shows ${c.J} Getting Quicker`,
        text: `The sports science report lands on the dressing-room screen: ${c.J}'s top speed and repeat-sprint numbers are the best of his career. The fitness coach circles them in red marker and writes nothing else. Nobody needs to.`,
        effects: { growth: [stat] },
      };
    },
  },
  {
    id: 'overtraining', type: 'training',
    weight: (s) => (s.player.pfm < 70 && !s.player.injury ? 9 : 2),
    build: (s, c) => ({
      headline: `Sports Scientists Flag ${c.J}'s Load`,
      text: `The numbers are red: heart-rate variability down, sleep scores down, hamstring readings tight. The physio recommends two days off. ${c.J} looks at the team sheet pinned to the wall and does the maths on what two days off means.`,
      decision: {
        type: 'tactical', prompt: 'The medical staff want you to rest. Do you?',
        choices: [
          { id: 'a', label: 'Rest', description: 'Take the two days, follow the recovery plan.', risk: 'low', consequence: 'Fitness recovers; the manager may read it as softness.' },
          { id: 'b', label: 'Push through', description: 'Train anyway. Spots are earned on the grass.', risk: 'high', consequence: 'Might build toughness — or cause an injury.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `${d.J} rests. The legs feel lighter by Thursday.`, effects: { pfm: 10, trust: -1 } }),
      b: (s, d) => chance(0.3)
        ? { text: `Thursday, sprint drill, third rep: something twangs high in the hamstring. ${d.J} walks off before anyone tells him to.`, effects: { injury: 'minor', trust: -2 } }
        : { text: `${d.J} grinds through the week. It hurts. It also earns a grunt of approval from the captain.`, effects: { pfm: -4, growth: ['physical'], trust: 1 } },
    },
  },
  {
    id: 'youth_rival', type: 'training',
    weight: (s, c) => (c.age >= 19 ? 6 : 0),
    build: (s, c) => {
      const kid = personName(s.player.club.country);
      return {
        headline: `Academy Kid ${kid.split(' ')[1]} Turns Heads in Training`,
        text: `He is seventeen, he plays ${c.J}'s position, and on Wednesday he nutmegs two senior players before lunch. ${kid}. The staff are already saying his name the way they used to say ${c.J}'s.`,
        data: { kid },
        decision: {
          type: 'personal', prompt: `${kid} is coming for your shirt. What do you do?`,
          choices: [
            { id: 'a', label: 'Mentor him', description: 'Take him under your wing.', risk: 'medium', consequence: 'Respect from staff and players. You might be training your replacement.' },
            { id: 'b', label: 'Freeze him out', description: 'Make sure he knows his place.', risk: 'high', consequence: 'Could protect your spot — or make you look small.' },
            { id: 'c', label: 'Ignore it', description: 'Focus on your own game.', risk: 'low', consequence: 'Nothing changes. Yet.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `${d.J} starts staying behind with ${d.kid}. The coaches see it. So does the kid, who now calls him "bang" or "big bro" depending on the day.`, effects: { trust: 3, rep: 0.5, teammate: { name: d.kid, rel: 'ally' }, thread: { inWeeks: randint(8, 16), id: 'fu_youth_rise', data: { kid: d.kid } } } }),
      b: (s, d) => chance(0.45)
        ? { text: `A late tackle in training, a cold shoulder in the canteen. ${d.M} saw the tackle. He says nothing, which is worse.`, effects: { trust: -5, teammate: { name: d.kid, rel: 'enemy' } } }
        : { text: `${d.kid} gets the message and goes quiet. ${d.J} keeps his shirt — for now.`, effects: { teammate: { name: d.kid, rel: 'rival' } } },
      c: (s, d) => ({ text: `${d.J} keeps his head down. ${d.kid} keeps getting better.`, effects: { teammate: { name: d.kid, rel: 'neutral' } } }),
    },
  },
  {
    id: 'fu_youth_rise', type: 'training', weight: () => 0,
    build: (s, c, data) => ({
      headline: `${data.kid.split(' ')[1]} Gets First-Team Debut`,
      text: `${data.kid} makes his debut this week. When he scores in training afterwards, the first person he runs to is ${c.J}. Whatever happens to the shirt, that moment is not nothing.`,
      effects: { rep: 0.5, followers: 2000 },
    }),
  },
  {
    id: 'extra_sessions', type: 'training',
    weight: () => 6,
    build: (s, c) => {
      const vet = personName(s.player.club.country);
      const stat = relevantStats(s.player.position)[0];
      return {
        headline: `Veteran ${vet.split(' ')[1]} Offers ${c.J} Extra Work`,
        text: `${vet}, thirty-four, two hundred league games, knees like old rope, catches ${c.J} at the car park. "Forty minutes after training. Every day. ${statLabel(stat)}. I'll show you what nobody showed me." He does not wait for an answer before walking off.`,
        data: { vet, stat },
        decision: {
          type: 'personal', prompt: 'Accept the extra sessions?',
          choices: [
            { id: 'a', label: 'Accept', description: 'Forty extra minutes a day.', risk: 'medium', consequence: 'Could improve a key stat; costs fitness.' },
            { id: 'b', label: 'Decline politely', description: 'Recovery matters too.', risk: 'low', consequence: 'No gain, no cost. He might take it personally.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => chance(0.55)
        ? { text: `The extra sessions are brutal and boring and they work. ${d.vet} says "better" once, which from him is a speech.`, effects: { pfm: -5, growth: [d.stat], teammate: { name: d.vet, rel: 'ally' } } }
        : { text: `Two weeks of extra work and nothing to show for it yet but sore calves. ${d.vet} shrugs: "It comes later."`, effects: { pfm: -5, teammate: { name: d.vet, rel: 'ally' } } },
      b: (s, d) => ({ text: `${d.vet} raises an eyebrow and walks away. He will not offer twice.`, effects: { teammate: { name: d.vet, rel: 'neutral' } } }),
    },
  },
  {
    id: 'video_review', type: 'training',
    weight: (s) => (s.player.form < 6.6 ? 8 : 3),
    build: (s, c) => ({
      headline: `${c.J} Faces the Video Room`,
      text: `The lights go down. Eleven clips, all of ${c.J}: a lost duel, a pass to nobody, a jog back that should have been a sprint. The assistant coach pauses on each one and lets the silence do the talking.`,
      decision: {
        type: 'tactical', prompt: 'How do you take the criticism?',
        choices: [
          { id: 'a', label: 'Own it', description: 'Nod, take notes, ask for more clips.', risk: 'low', consequence: 'Staff respect; mental growth possible.' },
          { id: 'b', label: 'Argue back', description: 'Some of those were not your fault.', risk: 'medium', consequence: 'You might be right. They will not care.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `${d.J} asks for the clips on a USB stick and watches them twice more at home.`, effects: { trust: 2, growth: chance(0.5) ? ['mental'] : [] } }),
      b: (s, d) => ({ text: `${d.J} points out that the full-back left him two-on-one. The assistant coach writes something down. It is not "good point".`, effects: { trust: -4 } }),
    },
  },

  // ───────────────────────── PERSONAL ─────────────────────────
  {
    id: 'homesick', type: 'personal',
    weight: (s, c) => (s.player.club && s.player.club.country !== s.player.nationality ? 10 : c.age <= 18 ? 3 : 0),
    build: (s, c) => ({
      headline: `Far From Home, ${c.J} Struggles to Sleep`,
      text: `It is 2am and the apartment is too quiet. The food is wrong, the jokes in the dressing room land a second late, and the family group chat is full of photos from a wedding ${c.J} could not attend. The phone screen is the brightest thing in the room.`,
      decision: {
        type: 'personal', prompt: 'Homesickness is biting. What do you do?',
        choices: [
          { id: 'a', label: 'Fly home on the day off', description: 'Thirty-six hours, there and back.', risk: 'medium', consequence: 'Heart refilled; legs drained. Late return would cost trust.' },
          { id: 'b', label: 'Call home every night', description: 'Video calls, long ones.', risk: 'low', consequence: 'Helps a little. Does not fix it.' },
          { id: 'c', label: 'Bury it', description: 'Football first. Feelings later.', risk: 'medium', consequence: 'Works until it doesn\'t.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => chance(0.3)
        ? { text: `The return flight is delayed. ${d.J} arrives at training forty minutes late with his bag still in his hand.`, effects: { trust: -8, pfm: -4, parental: 6, mood: 'Relieved' } }
        : { text: `A day of his mother's cooking and his own bed. ${d.J} lands back calmer than he has been in months.`, effects: { pfm: -3, parental: 6, growth: ['mental'], mood: 'Relieved' } },
      b: (s, d) => ({ text: `The calls help. His little brother falls asleep on camera one night and nobody hangs up.`, effects: { parental: 3 } }),
      c: (s, d) => chance(0.4)
        ? { text: `It leaks out anyway — a snapped answer at a teammate, a flat performance in training.`, effects: { trust: -2, mood: 'Homesick' } }
        : { text: `${d.J} locks it away and trains like a man with something to prove.`, effects: { mood: 'Determined' } },
    },
  },
  {
    id: 'family_money', type: 'personal',
    weight: (s, c) => (s.player.wealthEUR > 800 && c.week - (s.flags.familyMoneyWeek ?? -99) > 30 ? 4 : 0),
    build: (s, c) => {
      s.flags.familyMoneyWeek = c.week;
      const need = pick(['an uncle\'s failing warung needs saving', 'a cousin\'s university fees are due', 'the family roof is leaking through the rainy season', 'his father\'s motorbike — the family\'s only transport — has been stolen']);
      const amount = Math.round(Math.max(150, s.player.wealthEUR * (0.2 + Math.random() * 0.2)) / 10) * 10;
      return {
        headline: `Family Calls: ${c.J} Asked for Help`,
        text: `His mother does not ask directly. She never does. She just mentions that ${need}, and then talks about the weather for ten minutes. ${c.J} understands exactly what is being asked.`,
        data: { amount },
        decision: {
          type: 'financial', prompt: `Your family needs about €${amount}. What do you do?`,
          choices: [
            { id: 'a', label: 'Send it all', description: `Transfer €${amount} tonight.`, risk: 'low', consequence: 'Family grateful; savings hit hard.' },
            { id: 'b', label: 'Monthly support', description: 'Set up a regular transfer instead.', risk: 'medium', consequence: 'Sustainable — but it never stops.' },
            { id: 'c', label: 'Say no', description: 'You are building something. Not yet.', risk: 'medium', consequence: 'Savings safe. Relationship strained.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `The money goes that night. His mother sends a voice note that is mostly crying and a little bit of laughing.`, effects: { wealth: -d.amount, parental: 12, mood: 'Relieved' } }),
      b: (s, d) => ({ text: `${d.J} sets up a monthly transfer. It feels like being an adult in a way that scoring never has.`, effects: { monthlySupport: Math.max(20, Math.round(Math.min(d.amount / 5, (s.player.club?.wageWeekly ?? 100) * 4.33 * 0.1))), parental: 8 } }),
      c: (s, d) => ({ text: `The silence on the family chat for the next few days is loud.`, effects: { parental: -12, mood: 'Anxious' } }),
    },
  },
  {
    id: 'teammate_conflict', type: 'drama',
    weight: () => 7,
    build: (s, c) => {
      const name = personName(s.player.club.country);
      return {
        headline: `Training-Ground Tension: ${c.J} vs ${name.split(' ')[1]}`,
        text: `${name} has been at the club eight years and he has opinions about young players who ${pick(['wear headphones on the bus', 'post too much on Instagram', 'don\'t carry the cones', 'celebrate too much in training'])}. Today he says it in front of everyone. A few people laugh. Most look at ${c.J}.`,
        data: { name },
        decision: {
          type: 'personal', prompt: `${name} is mocking you publicly. Response?`,
          choices: [
            { id: 'a', label: 'Confront him', description: 'Right here, right now.', risk: 'high', consequence: 'Earn respect or start a war — maybe both.' },
            { id: 'b', label: 'Go to the captain', description: 'Handle it through the dressing-room hierarchy.', risk: 'low', consequence: 'Mature. Some will call it snitching.' },
            { id: 'c', label: 'Laugh it off', description: 'Make a joke back. Move on.', risk: 'medium', consequence: 'Could defuse it — or invite more.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => chance(0.5)
        ? { text: `Face to face, chest to chest — then ${d.name} grins and slaps his cheek. "Finally. Some balls." Strange, but they are fine after that.`, effects: { teammate: { name: d.name, rel: 'ally' }, rep: 0.3 } }
        : { text: `It turns into shoving, then a fine from the club, then a story in the local paper. ${d.M} is not impressed.`, effects: { trust: -8, wealth: -100, teammate: { name: d.name, rel: 'enemy' }, mood: 'Angry' } },
      b: (s, d) => ({ text: `The captain has a quiet word. ${d.name} stops — but tells everyone why.`, effects: { trust: 1, teammate: { name: d.name, rel: 'rival' } } }),
      c: (s, d) => chance(0.6)
        ? { text: `${d.J}'s comeback gets a bigger laugh than the original. ${d.name} raises his hands: fair.`, effects: { teammate: { name: d.name, rel: 'neutral' } } }
        : { text: `The joke falls flat. ${d.name} smells weakness and the comments keep coming.`, effects: { teammate: { name: d.name, rel: 'rival' }, mood: 'Frustrated' } },
    },
  },
  {
    id: 'partner_meet', type: 'personal',
    weight: (s, c) => (c.age >= 18 && s.player.partner.status === 'none' ? 4 : 0),
    build: (s, c) => {
      const name = personName(s.player.club.country, true);
      return {
        headline: `${c.J} Meets Someone Who Doesn't Care About Football`,
        text: `A friend's birthday, a crowded café, and ${name}, who asks what he does for a living and then genuinely forgets. She is studying, she is funny, and she leaves first.`,
        data: { name },
        decision: {
          type: 'personal', prompt: `Ask ${name.split(' ')[0]} out?`,
          choices: [
            { id: 'a', label: 'Ask her out', description: 'Life is not only football.', risk: 'medium', consequence: 'A relationship brings stability — and distractions.' },
            { id: 'b', label: 'Focus on football', description: 'Not now. Maybe never.', risk: 'low', consequence: 'Nothing gained, nothing lost.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => chance(0.7)
        ? { text: `She says yes, then says "but I'm not coming to matches," which somehow makes it better.`, effects: { partner: { name: d.name, status: 'dating' }, mood: 'Confident' } }
        : { text: `She says she is flattered. She also says no.`, effects: { mood: 'Numb' } },
      b: (s, d) => ({ text: `${d.J} goes home early and does his stretching. Some nights the discipline feels lonely.`, effects: {} }),
    },
  },
  {
    id: 'partner_milestone', type: 'personal',
    weight: (s, c) => (['dating', 'serious'].includes(s.player.partner.status) && c.age >= 19 ? 4 : 0),
    build: (s, c) => {
      const p = s.player.partner;
      const step = p.status === 'dating' ? 'move in together' : 'get married';
      return {
        headline: p.status === 'dating' ? `${c.J} and ${p.name.split(' ')[0]}: Next Step?` : `Wedding Bells for ${c.J}?`,
        text: `${p.name} has been patient through the travel, the bad moods after losses, the phone that never stops buzzing. Tonight she asks, gently, whether they are going to ${step}.`,
        data: { step },
        decision: {
          type: 'personal', prompt: `Do you ${step}?`,
          choices: [
            { id: 'a', label: 'Yes', description: 'Commit.', risk: 'medium', consequence: 'Stability at home. Life gets bigger.' },
            { id: 'b', label: 'Not yet', description: 'Career first, for now.', risk: 'high', consequence: 'She may not wait.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: s.player.partner.status === 'dating' ? `Boxes, a too-small sofa, an argument about where the trophies (none yet) will go. ${d.J} has never been happier.` : `A small ceremony, family on both sides, a dressing-room group chat that will not stop sending memes. ${d.J} is married.`, effects: { partner: { status: s.player.partner.status === 'dating' ? 'serious' : 'married' }, growth: ['mental'], parental: 4, mood: 'Relieved', followers: 5000 } }),
      b: (s, d) => chance(0.5)
        ? { text: `A week later her things are gone. The apartment has never been this quiet.`, effects: { partner: { name: '', status: 'none' }, mood: 'Broken' } }
        : { text: `She says she understands. She does, mostly.`, effects: {} },
    },
  },
  {
    id: 'mental_pressure', type: 'personal',
    weight: (s) => ((s.player.form < 6.3 || s.player.squadRole === 'bench' || s.player.squadRole === 'outcast') ? 8 : 1),
    build: (s, c) => ({
      headline: `Behind the Smile, ${c.J} Is Struggling`,
      text: `He scrolls the comments he promised himself he would not read. He replays the same mistake on the ceiling at 3am. In training his first touch is suddenly a stranger. Nobody has noticed — or everybody has, and nobody knows what to say.`,
      decision: {
        type: 'personal', prompt: 'The pressure is getting to you.',
        choices: [
          { id: 'a', label: 'See the club psychologist', description: 'Book the session nobody talks about.', risk: 'low', consequence: 'Real help. Some old-school voices will sneer.' },
          { id: 'b', label: 'Talk to family', description: 'Call home and actually say it.', risk: 'low', consequence: 'Lighter heart. No tactics in it.' },
          { id: 'c', label: 'Keep it inside', description: 'Footballers don\'t complain.', risk: 'high', consequence: 'Risk of it getting worse.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `The first session is awkward. The second is not. ${d.J} leaves with three breathing exercises and the strange relief of having said it out loud.`, effects: { growth: ['mental'], mood: 'Determined' } }),
      b: (s, d) => ({ text: `His father, who never says much, says: "We are proud of you whether you play or not." ${d.J} has to end the call quickly.`, effects: { parental: 6, mood: 'Relieved' } }),
      c: (s, d) => chance(0.5)
        ? { text: `It gets worse before it gets better. A flat week; a short temper.`, effects: { stat: { mental: -1 }, mood: 'Numb' } }
        : { text: `He white-knuckles it and, for now, survives.`, effects: { mood: 'Numb' } },
    },
  },
  {
    id: 'ramadan', type: 'personal',
    weight: (s, c) => (c.ramadan && s.player.nationality === 'Indonesia' && !s.flags.ramadanAsked?.[c.year] ? 30 : 0),
    build: (s, c) => {
      s.flags.ramadanAsked = { ...(s.flags.ramadanAsked ?? {}), [c.year]: true };
      return {
        headline: `Ramadan Begins: ${c.J} Plans His Month`,
        text: `Sahur at 3:30am, training in the afternoon heat, matches kicking off around iftar. ${c.J} grew up fasting through school football; doing it as a professional is a different kind of test. The club nutritionist has a plan ready if he wants it.`,
        decision: {
          type: 'personal', prompt: 'How do you manage Ramadan this season?',
          choices: [
            { id: 'a', label: 'Fast with the club plan', description: 'Adjust sleep, meal timing and training load with the staff.', risk: 'low', consequence: 'Small fitness dip, handled professionally.' },
            { id: 'b', label: 'Fast and train as normal', description: 'No adjustments. Tough it out.', risk: 'medium', consequence: 'Bigger fitness dip; character on show.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `The plan works: shorter, sharper sessions, dates and water on the touchline at iftar. ${d.J} feels the month, but manages it.`, effects: { pfm: -3, growth: ['mental'], parental: 3 } }),
      b: (s, d) => ({ text: `The last ten days are hard. ${d.J} finishes sessions grey-faced — and finishes them.`, effects: { pfm: -7, growth: ['mental'], parental: 3, trust: 1 } }),
    },
  },
  {
    id: 'charity_visit', type: 'personal',
    weight: (s) => (s.player.reputation >= 5 ? 3 : 0),
    build: (s, c) => {
      const cost = Math.round(Math.max(100, s.player.wealthEUR * 0.08) / 10) * 10;
      return {
        headline: `${c.J}'s Old School Asks for Help`,
        text: `The headmaster of ${c.J}'s old primary school sends a message: the football pitch has flooded again and the kids are playing in a car park. Would he come and visit? Maybe help with new goals and drainage?`,
        data: { cost },
        decision: {
          type: 'personal', prompt: `Visit and donate about €${cost}?`,
          choices: [
            { id: 'a', label: 'Visit and donate', description: 'Go in person, pay for the pitch.', risk: 'low', consequence: 'Costs money and a day off. Builds reputation.' },
            { id: 'b', label: 'Send a signed shirt', description: 'Kind, cheap, distant.', risk: 'low', consequence: 'Fine. Forgettable.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `Two hundred kids in his old school uniform screaming his name. ${d.J} plays twenty minutes of barefoot football on a wet pitch and has not smiled like this all season.`, effects: { wealth: -d.cost, rep: 1, followers: 8000, parental: 5, mood: 'Motivated' } }),
      b: (s, d) => ({ text: `The shirt is framed in the headmaster's office. The pitch is still flooded.`, effects: { rep: 0.1 } }),
    },
  },

  // ───────────────────────── DRAMA / PRESS ─────────────────────────
  {
    id: 'social_incident', type: 'drama',
    weight: (s) => (s.player.followers > 3000 ? 6 : 0),
    build: (s, c) => ({
      headline: `${c.J} Video Goes Viral for the Wrong Reasons`,
      text: `It is a twelve-second clip: ${c.J} ${pick(['dancing in the car park an hour after a defeat', 'laughing in the stands while injured teammates struggle on the pitch', 'joking about a rival club\'s supporters at a friend\'s wedding'])}. Context does not matter online. By lunchtime it has two million views and the club's media officer has called three times.`,
      decision: {
        type: 'media', prompt: 'The internet is angry. Your response?',
        choices: [
          { id: 'a', label: 'Apologise publicly', description: 'Short, sincere statement.', risk: 'low', consequence: 'Story dies faster. Some call it weak.' },
          { id: 'b', label: 'Say nothing', description: 'Delete, lock comments, wait.', risk: 'medium', consequence: 'Could fade — or fester.' },
          { id: 'c', label: 'Double down', description: '"I\'ll dance when I want."', risk: 'high', consequence: 'Followers spike. Club and manager furious.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `The apology is four lines long and does its job. The club's media officer sends a thumbs-up emoji, which is the most warmth she has ever shown.`, effects: { rep: -0.3, followers: 3000, trust: 1 } }),
      b: (s, d) => chance(0.5)
        ? { text: `Silence works. A bigger scandal elsewhere buries the clip within days.`, effects: {} }
        : { text: `Silence is read as arrogance. A columnist writes a whole piece about "this generation".`, effects: { rep: -1, trust: -2 } },
      c: (s, d) => ({ text: `The defiant post gets more likes than anything ${d.J} has ever done on a pitch. The club fines him a week's wages. ${d.M} does not make eye contact on Monday.`, effects: { followers: Math.round(30000 + s.player.followers * 0.2), trust: -8, rep: -1, wealth: -Math.round(s.player.club?.wageWeekly ?? 0), mood: 'Angry' } }),
    },
  },
  {
    id: 'press_conference', type: 'press',
    weight: (s) => (s.player.reputation >= 10 ? 6 : 0),
    build: (s, c) => ({
      headline: `${c.J} Faces the Press`,
      text: `The club puts ${c.J} in front of the microphones for the first time in weeks. The third question is the one everyone came for: "There are reports you are unhappy with your playing time under ${c.M}. Is that true?"`,
      decision: {
        type: 'media', prompt: 'How do you answer?',
        choices: [
          { id: 'a', label: 'Diplomatic', description: '"I trust the coach. I work every day."', risk: 'low', consequence: 'Manager appreciates it. Boring headlines.' },
          { id: 'b', label: 'Honest', description: '"Every player wants to play more."', risk: 'medium', consequence: 'Fans like honesty. The manager may not.' },
          { id: 'c', label: 'Pointed', description: '"Ask the coach. I\'m ready."', risk: 'high', consequence: 'Big headlines. Public criticism of the manager is costly.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `The quotes are bland, which is the point. ${d.M} gives him a nod in the corridor.`, effects: { trust: 2 } }),
      b: (s, d) => ({ text: `"Honest ${d.J}" trends locally for an afternoon. ${d.M} says he respects ambition — through slightly gritted teeth.`, effects: { trust: -3, rep: 0.5, followers: 4000 } }),
      c: (s, d) => ({ text: `The back pages lead with it. ${d.M} answers the next day: "Players who want to play should train better." War is declared.`, effects: { trust: -15, rep: 1, followers: 12000, mood: 'Angry' } }),
    },
  },
  {
    id: 'rival_fans', type: 'drama',
    weight: (s) => (s.player.followers > 2000 ? 4 : 0),
    build: (s, c) => ({
      headline: `Rival Fans Target ${c.J} Online`,
      text: `Derby week, and ${c.J}'s mentions are a sewer. His mother's photo, edited. His mistakes, slowed down and set to music. One account has posted forty times in a day.`,
      decision: {
        type: 'media', prompt: 'The abuse is relentless.',
        choices: [
          { id: 'a', label: 'Fire back', description: 'One cutting reply.', risk: 'high', consequence: 'Huge engagement. Club will not like it.' },
          { id: 'b', label: 'Report and ignore', description: 'Hand it to the club\'s safeguarding team.', risk: 'low', consequence: 'Professional. Does not feel satisfying.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `His reply gets screenshotted into every football group in the country. The club's communications team issue "guidance".`, effects: { followers: 15000, trust: -3, rep: 0.2 } }),
      b: (s, d) => ({ text: `The club's team takes it over. Three accounts are suspended. The rest just find new ones.`, effects: { trust: 1 } }),
    },
  },
  {
    id: 'manager_clash', type: 'drama',
    weight: (s) => (s.player.manager.trust <= 35 ? 10 : 0),
    build: (s, c) => ({
      headline: `${c.J} Left Out Again — Talks With ${c.M}?`,
      text: `The squad list goes up and ${c.J}'s name is not on it again. In the corridor, ${c.M} walks past without stopping. The door to his office is open. It feels like an invitation, or a dare.`,
      decision: {
        type: 'tactical', prompt: 'You are being frozen out.',
        choices: [
          { id: 'a', label: 'Knock on his door', description: 'Ask directly what you need to change.', risk: 'medium', consequence: 'Could clear the air — or confirm the worst.' },
          { id: 'b', label: 'Work in silence', description: 'Let training do the talking.', risk: 'low', consequence: 'Slow. Sometimes it works.' },
          { id: 'c', label: 'Ask your agent to call', description: 'Make it clear you will leave if needed.', risk: 'high', consequence: 'Agitating for a transfer damages trust.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => chance(0.5)
        ? { text: `Forty minutes in ${d.M}'s office. Honest, uncomfortable, useful. He gives ${d.J} three things to fix and a sliver of hope.`, effects: { trust: 6, mood: 'Determined' } }
        : { text: `"I pick the team I think wins." That is it. ${d.J} leaves knowing less than when he went in.`, effects: { trust: -3, mood: 'Frustrated' } },
      b: (s, d) => ({ text: `${d.J} is first in, last out for a week. Nobody says anything. Somebody notices.`, effects: { trust: 3, pfm: -2 } }),
      c: (s, d) => ({ text: `The agent makes the call. Within a day the dressing room knows. ${d.M} now has a reason.`, effects: { trust: -10, transferListed: true, mood: 'Angry' } }),
    },
  },
  {
    id: 'manager_praise', type: 'press',
    weight: (s) => (s.player.manager.trust >= 72 ? 6 : 0),
    build: (s, c) => ({
      headline: `${c.M}: "${c.J} Is the Model Professional"`,
      text: `Asked about his squad in the pre-match press conference, ${c.M} goes out of his way to mention ${c.J}: "He trains like he has never played a game. I wish I had ten like him." The quote is everywhere by the evening.`,
      effects: { rep: 1, followers: 3000, trust: 1, mood: 'Confident' },
    }),
  },
  {
    id: 'late_training', type: 'drama',
    weight: (s, c) => (c.age <= 22 ? 4 : 2),
    build: (s, c) => ({
      headline: `Traffic Chaos Leaves ${c.J} Running Late`,
      text: `A flooded underpass, a broken-down bus, a phone at 4%. ${c.J} pulls into the training ground eighteen minutes after the session started. The fines board in the dressing room is right next to the door.`,
      decision: {
        type: 'personal', prompt: 'You are late. What do you say?',
        choices: [
          { id: 'a', label: 'The truth', description: 'Apologise, accept the fine.', risk: 'low', consequence: 'Small hit to trust. Respect for honesty.' },
          { id: 'b', label: 'A better excuse', description: '"Family emergency."', risk: 'high', consequence: 'Might work. Lies in dressing rooms rarely stay hidden.' },
        ],
      },
    }),
    resolve: {
      a: (s, d) => ({ text: `${d.J} apologises in front of everyone and pays the fine. ${d.M} says "next time leave earlier" and that is the end of it.`, effects: { trust: -3, wealth: -50 } }),
      b: (s, d) => chance(0.6)
        ? { text: `The excuse works. ${d.J} feels sick about it all afternoon.`, effects: {} }
        : { text: `A teammate's girlfriend saw him in traffic, posting a selfie. The "family emergency" is now dressing-room legend. ${d.M} is not laughing.`, effects: { trust: -10, wealth: -100, mood: 'Anxious' } },
    },
  },

  // ───────────────────────── MONEY / CONTRACT ─────────────────────────
  {
    id: 'agent_approach', type: 'contract',
    weight: (s) => (!s.player.agent || s.player.agent.quality < 50 ? (s.player.reputation >= 6 ? 6 : 1) : 0),
    build: (s, c) => {
      const name = personName(pick([s.player.nationality, 'England', 'Netherlands']));
      return {
        headline: `Super-Agent ${name.split(' ')[1]} Courts ${c.J}`,
        text: `Expensive watch, cheap cologne, a laminated folder of players he says he has "placed" in Europe and the Gulf. ${name} slides a contract across the table: 10% of everything, exclusive, three years. "Sign with me and you won't be here in two years."`,
        data: { name },
        decision: {
          type: 'financial', prompt: `Sign with ${name}?`,
          choices: [
            { id: 'a', label: 'Sign now', description: 'Opportunity knocks once.', risk: 'high', consequence: 'Could open doors — or be a shark.' },
            { id: 'b', label: 'Check his references', description: 'Call players he claims to represent.', risk: 'low', consequence: 'Takes time. Reveals the truth.' },
            { id: 'c', label: 'Stay as you are', description: 'Keep your current arrangement.', risk: 'low', consequence: 'Nothing changes.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => chance(0.45)
        ? { text: `Six weeks in, ${d.name}'s phone is always "in a meeting". The small print says 15%, not 10%.`, effects: { agent: { name: d.name, quality: randint(15, 35), cut: 15 }, mood: 'Frustrated' } }
        : { text: `${d.name} is the real thing: three calls a day, every scout's number, a plan.`, effects: { agent: { name: d.name, quality: randint(60, 85), cut: 10 } } },
      b: (s, d) => chance(0.5)
        ? { text: `Two of the "clients" have never heard of him. ${d.J} deletes the number and finds a smaller, honest agent through a former coach.`, effects: { agent: { name: personName(s.player.nationality), quality: randint(45, 65), cut: 8 } } }
        : { text: `The references check out. ${d.J} signs, with a lawyer reading every line first.`, effects: { agent: { name: d.name, quality: randint(65, 85), cut: 9 }, wealth: -150 } },
      c: (s, d) => ({ text: `${d.J} says no thanks. ${d.name} smiles like he has heard that before.`, effects: {} }),
    },
  },
  {
    id: 'sponsorship', type: 'contract',
    weight: (s) => (s.player.reputation >= 8 && s.player.endorsements.length < 3 ? 6 : 0),
    build: (s, c) => {
      const local = s.player.nationality === 'Indonesia';
      const brand = pick(local ? ['Ortuseight', 'Specs', 'Mills', 'a local kopi chain', 'an e-wallet app', 'a motorbike dealer'] : ['a regional sportswear brand', 'an energy drink', 'a mobile game', 'a local car dealer']);
      const value = Math.round((800 + s.player.reputation * s.player.reputation * 60) / 100) * 100;
      return {
        headline: `${c.J} Offered First Big Sponsorship`,
        text: `${brand[0].toUpperCase() + brand.slice(1)} wants ${c.J}'s face on billboards: €${value.toLocaleString()} a year, two years, four content days and a boot/clothing clause. His agent says it is fair. His agent also says it could be more.`,
        data: { brand, value },
        decision: {
          type: 'financial', prompt: 'Sponsorship offer on the table.',
          choices: [
            { id: 'a', label: 'Accept', description: `€${value.toLocaleString()}/year for 2 years.`, risk: 'low', consequence: 'Guaranteed money and exposure.' },
            { id: 'b', label: 'Hold out for more', description: 'Make them sweat.', risk: 'medium', consequence: 'Better deal — or no deal.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `${d.J} signs. A week later his face is ten metres tall on a billboard near his parents' house.`, effects: { endorsement: { brand: d.brand, type: 'regional', annualValue: d.value, years: 2 }, followers: 6000, parental: 3 } }),
      b: (s, d) => chance(0.45)
        ? { text: `The brand comes back with 40% more. ${d.J}'s agent is insufferable for days.`, effects: { endorsement: { brand: d.brand, type: 'regional', annualValue: Math.round(d.value * 1.4), years: 2 }, followers: 6000 } }
        : { text: `The brand signs a teammate instead. His billboard goes up at the training-ground roundabout.`, effects: { mood: 'Frustrated' } },
    },
  },
  {
    id: 'investment', type: 'contract',
    weight: (s) => (s.player.wealthEUR > 4000 ? 4 : 0),
    build: (s, c) => {
      const what = pick(['a coffee shop chain', 'a crypto token "backed by footballers"', 'boarding-house property', 'a futsal court complex']);
      const amount = Math.round(s.player.wealthEUR * 0.3 / 10) * 10;
      return {
        headline: `Friend Pitches ${c.J} an Investment`,
        text: `A childhood friend with a new car and a pitch deck: ${what}. "Guaranteed returns, bro. Everyone's in." He wants €${amount.toLocaleString()}.`,
        data: { what, amount },
        decision: {
          type: 'financial', prompt: `Invest €${amount.toLocaleString()} in ${what}?`,
          choices: [
            { id: 'a', label: 'Invest', description: 'Back your friend.', risk: 'high', consequence: 'Could pay off. Could vanish.' },
            { id: 'b', label: 'Decline', description: 'Money stays in the bank.', risk: 'low', consequence: 'Friend may sulk.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `${d.J} transfers the money. His friend sends a long voice note full of fire emojis.`, effects: { wealth: -d.amount, thread: { inWeeks: randint(10, 20), id: 'fu_investment', data: { what: d.what, amount: d.amount } } } }),
      b: (s, d) => ({ text: `The friend stops replying to messages for a while.`, effects: {} }),
    },
  },
  {
    id: 'fu_investment', type: 'contract', weight: () => 0,
    build: (s, c, data) => {
      const roll = Math.random();
      if (roll < 0.35) return { headline: `${c.J}'s Investment Collapses`, text: `The ${data.what} is gone. So is the friend, it turns out — his number is disconnected. €${data.amount.toLocaleString()}, vanished.`, effects: { mood: 'Angry' } };
      if (roll < 0.55) return { headline: `${c.J}'s Investment Returns His Money`, text: `The ${data.what} limps along. ${c.J} gets his money back and decides that is a win.`, effects: { wealth: data.amount } };
      return { headline: `${c.J}'s Side Business Is Booming`, text: `The ${data.what} actually works. The first return lands in ${c.J}'s account: a healthy profit on the €${data.amount.toLocaleString()} he put in.`, effects: { wealth: Math.round(data.amount * (1.4 + Math.random() * 0.6)), mood: 'Confident' } };
    },
  },
  {
    id: 'lifestyle', type: 'contract',
    weight: (s) => (s.player.wealthEUR > 2500 ? 4 : 0),
    build: (s, c) => {
      const price = Math.round(s.player.wealthEUR * 0.35 / 10) * 10;
      return {
        headline: `${c.J} Eyes a New Car`,
        text: `Half the squad drives something that roars. ${c.J} still drives the car his father helped him buy. The dealership has a matte black one, €${price.toLocaleString()}, "special price for footballers".`,
        data: { price },
        decision: {
          type: 'financial', prompt: 'Buy the car?',
          choices: [
            { id: 'a', label: 'Buy it', description: 'You earned this.', risk: 'medium', consequence: 'Big dent in savings. Instagram loves it.' },
            { id: 'b', label: 'Keep the old one', description: 'Money is for later.', risk: 'low', consequence: 'Some teammates will tease you.' },
          ],
        },
      };
    },
    resolve: {
      a: (s, d) => ({ text: `The car photo gets more likes than his last goal. His mother asks how much it cost and he lies.`, effects: { wealth: -d.price, followers: 4000, rep: -0.2, mood: 'Confident' } }),
      b: (s, d) => ({ text: `The old car survives another season. So do his savings.`, effects: {} }),
    },
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
