package CoolingSpecialization {
    part def Pump;
    part def ElectricPump :> Pump;

    part def CoolingUnit {
        part pumps : Pump[2..4];
        part activePumps : Pump[1..2] subsets pumps;
    }

    part def CompactCoolingUnit :> CoolingUnit {
        part redefines pumps : ElectricPump[2];
    }
}
