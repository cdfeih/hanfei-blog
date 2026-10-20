package CoolingStructure {
    part def Pump;

    part def CoolingUnit {
        part primary : Pump[1];
        part standby : Pump[1];
    }
}
